declare namespace JSX {
  interface IntrinsicElements {
    'shogi-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      csa?: string;
      player?: string;
      options?: string;
    }, HTMLElement>;
  }
}
