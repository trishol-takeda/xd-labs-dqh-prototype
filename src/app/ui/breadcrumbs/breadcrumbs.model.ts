export interface Crumb {
  label: string;
  /** Router link commands; omit for the current page. */
  link?: readonly (string | number)[];
}
