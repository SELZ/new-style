import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createTheme, MantineProvider } from "@mantine/core";
import { HashRouter } from "react-router-dom";
import "@mantine/core/styles.css";
import "./styles/fonts.css";
import "./styles/operations.css";
import { App } from "./App.tsx";
import { FileSyncProvider } from "./providers/FileSyncProvider.tsx";

const theme = createTheme({
  primaryColor: "teal",
  primaryShade: 7,
  fontFamily: "Manrope, Arial, sans-serif",
  headings: { fontFamily: "Manrope, Arial, sans-serif", fontWeight: "700" },
  defaultRadius: "md",
  colors: {
    teal: [
      "#e8f7f1",
      "#d4eee3",
      "#a7dbc5",
      "#78c6a6",
      "#51b48e",
      "#36a87e",
      "#289e73",
      "#137c66",
      "#146452",
      "#0b4e40",
    ],
  },
  components: {
    Button: { defaultProps: { fw: 600 } },
    Paper: { defaultProps: { radius: "lg" } },
  },
});
export function bootstrap(element: HTMLElement) {
  createRoot(element).render(
    <StrictMode>
      <MantineProvider theme={theme}>
        <HashRouter>
          <FileSyncProvider>
            <App />
          </FileSyncProvider>
        </HashRouter>
      </MantineProvider>
    </StrictMode>,
  );
}
