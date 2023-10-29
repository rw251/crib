const getWords = async () => {
  const words = await fetch('/words.json').then((resp) => resp.json());
  return words;
};

const hideAllPages = () => {
  [...document.querySelectorAll('.page')].forEach((page) => {
    page.style.display = 'none';
  });
};

const showButtonBar = (elements) => {
  // first hide all elements
  [...document.querySelectorAll('#top-button-bar button')].forEach((button) => {
    button.style.display = 'none';
  });
  document.getElementById('top-button-bar').style.display = 'flex';
  elements.forEach((element) => {
    document.getElementById(element).style.display = 'inline-block';
  });
};

const hideButtonBar = () => {
  document.getElementById('top-button-bar').style.display = 'none';
};

export { getWords, hideAllPages, showButtonBar, hideButtonBar };
