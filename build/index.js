import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";
const URL_EXCHANGE = "https://data.fixer.io/api/latest";
const API_KEY = '4d866050a9361a833dacb12554c901a4';
async function makeExchangeRequest(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json());
    }
    catch (error) {
        console.error("Error making NWS request:", error);
        return null;
    }
}
// Helper function for making NWS API requests
// Helper function for making NWS API requests
async function makeNWSRequest(url) {
    const headers = {
        "User-Agent": USER_AGENT,
        Accept: "application/geo+json",
    };
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json());
    }
    catch (error) {
        console.error("Error making NWS request:", error);
        return null;
    }
}
// Format alert data
function formatAlert(feature) {
    const props = feature.properties;
    return [
        `Event: ${props.event || "Unknown"}`,
        `Area: ${props.areaDesc || "Unknown"}`,
        `Severity: ${props.severity || "Unknown"}`,
        `Status: ${props.status || "Unknown"}`,
        `Headline: ${props.headline || "No headline"}`,
        "---",
    ].join("\n");
}
// Create server instance
const server = new McpServer({
    name: "weather",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});
// Register weather tools
server.tool("get-greetings", "Get Greetings from x name", {
    person: z.string().describe("Name of the x person"),
}, async ({ person }) => {
    const response = {
        text: `Hello my dear ${person} how can i help you today`
    };
    return {
        content: [
            {
                type: "text",
                text: `${JSON.stringify(response)}`,
            }
        ],
        structuredContent: response
    };
});
// Register weather tools
server.tool("get-exchange", "Get exchange rate based on some conrrencies", {
    concurriences: z.array(z.string()).describe("Concurriences to convert eg (COP,MXN,USD,EU)"),
}, async ({ concurriences }) => {
    const concurriencesCode = concurriences.join(',');
    const alertsUrl = `${URL_EXCHANGE}?access_key=${API_KEY}&symbols=${concurriencesCode}&format=1`;
    console.log(`request URL ${alertsUrl}`);
    const responseExchange = await makeExchangeRequest(alertsUrl);
    if (!responseExchange) {
        return {
            content: [
                {
                    type: "text",
                    text: "Failed to retrieve exchange data",
                }
            ]
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `${JSON.stringify(responseExchange)}`,
            }
        ],
        structuredContent: responseExchange
    };
});
server.tool("get-alerts", "Get weather alerts for a state", {
    state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
}, async ({ state }) => {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest(alertsUrl);
    if (!alertsData) {
        return {
            content: [
                {
                    type: "text",
                    text: "Failed to retrieve alerts data",
                },
            ],
        };
    }
    const features = alertsData.features || [];
    if (features.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `No active alerts for ${stateCode}`,
                },
            ],
        };
    }
    const formattedAlerts = features.map(formatAlert);
    const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;
    return {
        content: [
            {
                type: "text",
                text: alertsText,
            },
        ],
    };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Weather MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
