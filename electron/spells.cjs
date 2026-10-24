// Looks a spell up on wikidot (by name or link) and parses it into plain fields.
const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ndash;|&#8211;/g, '-')
    .replace(/&mdash;|&#8212;/g, '-')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))

function htmlToText(html) {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|h\d)>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<\/t[dh]>/gi, '  |  ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function fetchSpell(target) {
  try {
    let url = String(target || '').trim()
    if (!url) return { error: 'Enter a spell name or paste a wikidot link.' }
    if (!/^https?:\/\//i.test(url)) url = `https://dnd5e.wikidot.com/spell:${slugify(url)}`
    const u = new URL(url)
    if (!/(^|\.)wikidot\.com$/.test(u.hostname)) return { error: 'Only wikidot.com links can be fetched.' }
    const res = await fetch(u.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 CharacterSheet' } })
    if (!res.ok) return { error: `Page returned ${res.status}. Check the spell name or paste the link.`, url }
    const html = await res.text()
    const start = html.indexOf('id="page-content"')
    if (start < 0) return { error: 'Could not find spell text on that page.', url }
    let body = html.slice(html.indexOf('>', start) + 1)
    const end = body.search(/<div class="page-tags"|<div id="wad-|<!-- floating video/)
    if (end > 0) body = body.slice(0, end)
    body = body.replace(/<div class="content-separator"[^>]*><\/div>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
    const title = (html.match(/<div class="page-title[^>]*>\s*<span>([^<]+)<\/span>/) || [])[1]
    const text = htmlToText(body)
    const get = (label) => ((text.match(new RegExp(label + ':\\s*([^\\n]+)', 'i')) || [])[1] || '').trim()
    const casting = get('Casting Time')
    const range = get('Range')
    const comps = get('Components')
    const dur = get('Duration')
    const lvl = text.match(/(\d)(?:st|nd|rd|th)-level\s+([a-z]+)(\s*\(ritual\))?/i)
    const cantrip = text.match(/([a-z]+)\s+cantrip/i)
    const source = ((text.match(/Source:\s*([^\n]+)/i) || [])[1] || '').trim()
    const durIdx = text.search(/Duration:[^\n]*/i)
    let desc = durIdx >= 0 ? text.slice(text.indexOf('\n', durIdx)).trim() : text
    desc = desc.replace(/\n*Spell Lists\.?[\s\S]*$/i, '').trim()
    return {
      url,
      name: title ? decode(title) : '',
      level: lvl ? +lvl[1] : cantrip ? 0 : undefined,
      school: lvl ? lvl[2] : cantrip ? cantrip[1] : '',
      ritual: !!(lvl && lvl[3]) || /ritual/i.test(casting),
      castingTime: casting,
      range,
      components: comps,
      duration: dur,
      concentration: /concentration/i.test(dur),
      source,
      description: desc,
    }
  } catch (err) {
    return { error: `Could not reach the spell page (${err.message}). Are you online?` }
  }
}

module.exports = { fetchSpell }
