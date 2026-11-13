// Preview and drop must use the same lift so the visible card lands under its center.
export function getCardDragLift(pointerType: string, portrait: boolean, cellSize = 96 * .88) {
  return pointerType === 'mouse' ? 0 : portrait ? cellSize / 2 + 20 : 44;
}

export function getDragBoardCellSize(document: Document) {
  const board = Array.from(document.querySelectorAll<HTMLElement>('.game-board-container'))
    .find(element => !element.closest('[inert]') && element.getBoundingClientRect().height > 0);
  return board?.querySelector('.cell')?.getBoundingClientRect().width || 96 * .88;
}
