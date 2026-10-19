export function resolveXSidebarSearchPlacement(nativeForm: HTMLFormElement): {
  sidebarColumn: HTMLElement;
  nativeBranch: HTMLElement;
} | undefined {
  const sidebarColumn = nativeForm.closest<HTMLElement>('[data-testid="sidebarColumn"]');
  if (!sidebarColumn) return undefined;

  // X may center the search form in a fixed-height shell or offset a sticky
  // stack. Keep the workspace outside every wrapper between it and the column.
  let nativeBranch: HTMLElement = nativeForm;
  while (nativeBranch.parentElement && nativeBranch.parentElement !== sidebarColumn) {
    nativeBranch = nativeBranch.parentElement;
  }
  if (nativeBranch.parentElement !== sidebarColumn) return undefined;

  return { sidebarColumn, nativeBranch };
}
