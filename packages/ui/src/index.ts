export function createBootstrapView(title: string): HTMLElement {
  const main = document.createElement('main');
  const heading = document.createElement('h1');
  heading.textContent = title;
  main.append(heading);
  return main;
}
