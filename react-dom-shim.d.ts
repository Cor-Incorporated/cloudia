declare module 'react-dom/client' {
  import type { ReactNode } from 'react';

  interface Root {
    render(children: ReactNode): void;
  }

  const ReactDOM: {
    createRoot(container: Element | DocumentFragment): Root;
  };

  export default ReactDOM;
}

declare module 'react-dom/server' {
  import type { ReactNode } from 'react';

  export function renderToStaticMarkup(children: ReactNode): string;
}
