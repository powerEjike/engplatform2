export type ProjectHealth = "on_track" | "attention" | "behind";

export type PortfolioProject = {
  name: string;
  client: string;
  state: string;
  progress: number;
  schedule: ProjectHealth;
  variationExposure: number;
  lastReport: string;
};

export const portfolioProjects: PortfolioProject[] = [
  {
    name: "Gwarinpa Residential Estate",
    client: "Northgate Developments",
    state: "FCT Abuja",
    progress: 68,
    schedule: "on_track",
    variationExposure: 2_450_000,
    lastReport: "Today, 08:42",
  },
  {
    name: "Wuse Office Fit-Out",
    client: "Meridian Advisory",
    state: "FCT Abuja",
    progress: 42,
    schedule: "attention",
    variationExposure: 875_000,
    lastReport: "Yesterday, 16:18",
  },
  {
    name: "Kubwa Road Rehabilitation",
    client: "FCT Infrastructure Unit",
    state: "FCT Abuja",
    progress: 29,
    schedule: "behind",
    variationExposure: 5_200_000,
    lastReport: "4 days ago",
  },
  {
    name: "Kaduna Industrial Warehouse",
    client: "Westland Logistics",
    state: "Kaduna",
    progress: 54,
    schedule: "on_track",
    variationExposure: 1_150_000,
    lastReport: "Today, 09:15",
  },
  {
    name: "Lekki Commercial Complex",
    client: "Harbor Point Properties",
    state: "Lagos",
    progress: 17,
    schedule: "attention",
    variationExposure: 3_875_000,
    lastReport: "2 days ago",
  },
];

export const formatNaira = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
