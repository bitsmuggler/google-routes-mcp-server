import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {z} from "zod";
import axios from "axios";
import {RequestHandlerExtra} from "@modelcontextprotocol/sdk/shared/protocol.js";
import {ServerNotification, ServerRequest} from "@modelcontextprotocol/sdk/types.js";

// Replace with your Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "YOUR_API_KEY";

// Helper: geocode an address to lat/lng
async function geocodeAddress(address: string) {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json`;
    const response = await axios.get(geocodeUrl, {
        params: {
            address,
            key: GOOGLE_MAPS_API_KEY,
        },
    });

    if (response.data.status !== "OK" || !response.data.results?.length) {
        console.log(response.data.status);
        throw new Error(`Failed to geocode address "${address}": ${response.data.status}`);
    }

    const location = response.data.results[0].geometry.location;
    return {
        lat: location.lat,
        lng: location.lng,
    };
}

const server = new McpServer({
    name: "Google Routes MCP Server (with Geocoding)",
    version: "1.1.0",
});

// Tool: computeRouteWithAddresses
server.registerTool(
    "computeRouteWithAddresses",
    {
        title: "Compute Route With Addresses",
        description: "Compute a route using origin and destination addresses",
        inputSchema: {
            originAddress: z.string(),
            destinationAddress: z.string(),
        },
    },
    async (args: {
        originAddress: string,
        destinationAddress: string
    }, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
        // Geocode origin and destination
        const origin = await geocodeAddress(args.originAddress);
        console.log('Origin geocoded:', origin);
        const destination = await geocodeAddress(args.destinationAddress);
        console.log('Destination geocoded:', destination);

        const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;

        const requestBody = {
            origin: {
                location: {
                    latLng: {
                        latitude: origin.lat,
                        longitude: origin.lng,
                    },
                },
            },
            destination: {
                location: {
                    latLng: {
                        latitude: destination.lat,
                        longitude: destination.lng,
                    },
                },
            },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            computeAlternativeRoutes: false,
            units: "METRIC",
        };

        try {
            const response = await axios.post(
                url,
                requestBody,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                        "X-Goog-FieldMask": "*",
                    },
                }
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data),
                    },
                ],
            };
        } catch (error: any) {
            console.error("Error calling Google Routes API:", error.response?.data || error.message);
            throw new Error(`Failed to compute route: ${error.message}`);
        }
    }
);

// Start the MCP server with Stdio transport
server.connect(new StdioServerTransport());
