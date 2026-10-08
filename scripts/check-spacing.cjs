const assert = require('node:assert/strict');

exports.checkSpacing = async page => {
  const measurements = await page.evaluate(() => {
    const rect = node => node.getBoundingClientRect().toJSON();
    const nav = document.querySelector('.app-bottom-nav-inner');
    const favorites = document.querySelector('.favorites-list');
    return {
      nav: rect(nav),
      links: [...nav.querySelectorAll('.app-nav-link')].map(link => ({ link: rect(link), icon: rect(link.querySelector('.app-nav-icon')), label: rect(link.querySelector('.app-nav-label')) })),
      favorites: favorites && {
        heading: rect(document.querySelector('.favorites-header')),
        rows: [...favorites.querySelectorAll('.favorite-item')].map(row => ({ row: rect(row), icon: rect(row.querySelector('.favorite-icon')), label: rect(row.querySelector('.favorite-label')), arrow: rect(row.querySelector('.favorite-arrow')) })),
      },
    };
  });
  const close = (a, b, message) => assert(Math.abs(a - b) <= 1, `${message}: ${a} / ${b}`);
  const center = rect => rect.x + rect.width / 2;
  const { nav, links, favorites } = measurements;
  const step = nav.width / 5;
  links.forEach(({ link, icon, label }, i) => {
    close(link.width, step, 'All navigation choices must have equal widths');
    close(center(icon), nav.left + step * (i + .5), 'Icons must have equal center-to-center and edge spacing');
    close(center(label), center(icon), 'Labels must be centered below their icons');
    close(icon.top, links[0].icon.top, 'Icons must share the same top line');
    close(label.top, links[0].label.top, 'Labels must share the same baseline');
    assert(link.height >= 44, 'Navigation touch targets must remain reachable');
  });
  if (favorites) {
    const [first, second] = favorites.rows;
    close(first.row.top - favorites.heading.bottom, 16, 'Favorites title spacing');
    close(second.row.top - first.row.bottom, 16, 'Favorites row spacing');
    close(first.icon.left, second.icon.left, 'Favorite icons must align');
    close(first.label.left, second.label.left, 'Favorite account labels must align');
    close(first.arrow.right, second.arrow.right, 'Favorite arrows must align');
    for (const item of favorites.rows) close(item.icon.top + item.icon.height / 2, item.row.top + item.row.height / 2, 'Favorite icons must be vertically centered');
  }
};
