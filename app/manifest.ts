import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "点了么娱乐公会工作台",
    short_name: "点了么公会",
    description: "找陪玩、派单、接单、订单与账户管理。",
    start_url: "/console",
    display: "standalone",
    background_color: "#f2ede6",
    theme_color: "#171717",
    icons: [{ src: "/DLMLOGO-512.png", sizes: "512x512", type: "image/png" }],
  };
}
