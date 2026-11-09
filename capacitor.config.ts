import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lacquerpearl.app",
  appName: "Lacquer & Pearl",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  backgroundColor: "#fdf6ec",
};

export default config;
