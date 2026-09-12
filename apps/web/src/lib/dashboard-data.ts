export type ProjectHealth = "on_track" | "attention" | "behind";

export type PortfolioProject = {
  name: string;
  client: string;
  progress: number;
  schedule: ProjectHealth;
  variationExposure: number;
  lastReport: string;
};

export const portfolioProjects: PortfolioProject[] = [
  {
    name: "Gwarinpa Residential Estate",
    client: "Northgate Developments",
    progress: 68,
    schedule: "on_track",
    variationExposure: 2_450_000,
    lastReport: "Today, 08:42",
  },
  {
    name: "Wuse Office Fit-Out",
    client: "Meridian Advisory",
    progress: 42,
    schedule: "attention",
    variationExposure: 875_000,
    lastReport: "Yesterday, 16:18",
  },
  {
    name: "Kubwa Road Rehabilitation",
    client: "FCT Infrastructure Unit",
    progress: 29,
    schedule: "behind",
    variationExposure: 5_200_000,
    lastReport: "4 days ago",
  },
];

export const formatNaira = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
