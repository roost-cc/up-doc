export const modal = document.createElement('div');
modal.className = 'modal';

export const modalContent = document.createElement('div');
modalContent.className = 'modal-content';

const closeButton = document.createElement('button');
closeButton.className = 'close-button';
closeButton.innerHTML = '×';
closeButton.onclick = (e) => {
  hide();
  e.stopPropagation();
};
modal.appendChild(closeButton);
modal.appendChild(modalContent);

export function setContent(content) {
  modalContent.innerHTML = content;
}

export function addModal(parentElement = document.body) {
  if (!parentElement.contains(modal)) {
    parentElement.appendChild(modal);
  }
}

export function show() {
  modal.style.display = 'block';
}

export function hide() {
  modal.style.display = 'none';
}
