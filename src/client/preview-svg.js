// This accepts trusted local artwork, not user uploads. It is not an SVG sanitizer.
export function preparePreviewSvg(source, instanceId) {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') {
    throw new Error('Preview artwork must be a valid SVG document.');
  }

  const svg = document.documentElement;
  const prefix = `preview-${instanceId}-`;
  const ids = new Map([...svg.querySelectorAll('[id]')].map(node => [node.id, prefix + node.id]));
  if (svg.id) ids.set(svg.id, prefix + svg.id);
  let rootId = svg.id ? ids.get(svg.id) : `${prefix}root`;
  while (!svg.id && [...ids.values()].includes(rootId)) rootId += '-root';
  const rewriteUrls = value => value.replace(/url\(\s*(['"]?)#([^\s)'"]+)\1\s*\)/g,
    (match, quote, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);

  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    for (const attribute of [...node.attributes]) {
      let value = rewriteUrls(attribute.value);
      if (attribute.name === 'id') value = ids.get(value);
      if (attribute.localName === 'href' && value.startsWith('#') && ids.has(value.slice(1))) {
        value = `#${ids.get(value.slice(1))}`;
      }
      if (['aria-labelledby', 'aria-describedby'].includes(attribute.name)) {
        value = value.split(/\s+/).map(id => ids.get(id) ?? id).join(' ');
      }
      attribute.value = value;
    }
  }
  svg.id = rootId;
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  // Editors may export shared classes in a <style> block. Scope those rules so
  // .st0 in one drawing cannot recolor another drawing or the surrounding UI.
  for (const style of svg.querySelectorAll('style')) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(rewriteUrls(style.textContent));
    const scopeRules = rules => {
      for (const rule of rules) {
        if (rule.type === CSSRule.STYLE_RULE) {
          let selector = rule.selectorText;
          for (const [oldId, newId] of ids) {
            const escaped = CSS.escape(oldId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            selector = selector.replace(new RegExp(`#${escaped}(?![\\w-])`, 'g'), `#${CSS.escape(newId)}`);
          }
          const root = `:where(#${CSS.escape(rootId)})`;
          rule.selectorText = `${root} :is(${selector}), ${root}:is(${selector})`;
        } else if (rule.cssRules) {
          scopeRules(rule.cssRules);
        }
      }
    };
    scopeRules(sheet.cssRules);
    style.textContent = [...sheet.cssRules].map(rule => rule.cssText).join('\n');
  }
  return new XMLSerializer().serializeToString(svg);
}
