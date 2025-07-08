import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {z} from "zod";
import axios from "axios";

if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error("Missing GOOGLE_MAPS_API_KEY environment variable");
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function geocodeAddress(address: string) {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json`;
    const response = await axios.get(geocodeUrl, {
        params: {
            address,
            key: GOOGLE_MAPS_API_KEY
        },
        timeout: 5000
    });

    if (response.data.status !== "OK" || !response.data.results?.length) {
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
    version: "0.1.0",
});

server.registerTool(
    "computeRouteWithAddresses",
    {
        title: "Compute Route With Addresses",
        description: "Compute a route using origin and destination addresses",
        inputSchema: {
            originAddress: z.string().min(1, "Origin address is required").describe("The address of the origin location"),
            destinationAddress: z.string().min(1, "Destination address is required").describe("The address of the destination location"),
            travel: z.object({
                travelMode: z.enum(['DRIVE', 'BICYCLE', 'WALK', 'TWO_WHEELER', 'TRANSIT'])
                    .default('DRIVE')
                    .describe("The travel mode for the route"),
                routingPreference: z.enum([
                    'TRAFFIC_UNAWARE',
                    'TRAFFIC_AWARE',
                    'TRAFFIC_AWARE_OPTIMAL',
                ])
                    .optional()
                    .describe("The routing preference for the route"),
            }).refine(
                (data) => {
                    return !(data.travelMode === 'TRANSIT' && data.routingPreference !== undefined);
                },
                {
                    message: "routingPreference cannot be set when travelMode is TRANSIT",
                    path: ['routingPreference'],
                }
            ),
            units: z.enum(['METRIC', 'IMPERIAL'])
                .default('METRIC')
                .describe("The units for the route"),
            computeAlternativeRoutes: z.boolean()
                .default(false)
                .describe("Whether to compute alternative routes"),
        },
    },
    async (args: {
        originAddress: string,
        destinationAddress: string,
        travel: {
            travelMode: 'DRIVE' | 'BICYCLE' | 'WALK' | 'TWO_WHEELER' | 'TRANSIT',
            routingPreference?: 'TRAFFIC_UNAWARE' | 'TRAFFIC_AWARE' | 'TRAFFIC_AWARE_OPTIMAL',
        }
        units?: 'METRIC' | 'IMPERIAL',
        computeAlternativeRoutes?: boolean,
    }) => {
        const origin = await geocodeAddress(args.originAddress);
        const destination = await geocodeAddress(args.destinationAddress);
        const travelMode = args.travel.travelMode || "DRIVE";
        const routingPreference = args.travel.routingPreference;
        const units = args.units || "METRIC";
        const computeAlternativeRoutes = args.computeAlternativeRoutes || false;

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
            travelMode,
            routingPreference,
            computeAlternativeRoutes,
            units,
        };

        try {
            const response = await axios.post(
                url,
                requestBody,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                        "X-Goog-FieldMask": "routes.*"
                    },
                }
            );

            const rawRoutes = response.data.routes || [];
            const simplifiedRoutes = rawRoutes.map((route: any) => ({
                labels: route.routeLabels,
                distanceMeters: route.distanceMeters,
                duration: route.duration,
                legs: route.legs?.map((leg: any) => ({
                    startAddress: leg.startLocation,
                    endAddress: leg.endLocation,
                    distanceMeters: leg.distanceMeters,
                    duration: leg.duration,
                    steps: leg.steps?.map((step: any) => ({
                        distanceMeters: step.distanceMeters,
                        duration: step.duration,
                        navigationInstruction: step.navigationInstruction,
                    })),
                })),
            }));

            const result = {
                routes: simplifiedRoutes,
                metadata: {
                    origin: args.originAddress,
                    destination: args.destinationAddress,
                    travelMode,
                    routingPreference,
                    units,
                    alternativeRoutes: computeAlternativeRoutes,
                },
                summary: `Calculated ${simplifiedRoutes.length} route(s) from "${args.originAddress}" to "${args.destinationAddress}".`,
            };

            return {
                content: [
                    {
                        type: "text",
                        text: `ROUTE_RESULT\n` + JSON.stringify(result, null, 2),
                    },
                ],
            };

        } catch (error: any) {
            throw new Error(`Failed to compute route: ${error.response?.status} ${JSON.stringify(error.response?.data)}`);
        }
    }
);

// Start the MCP server with Stdio transport
server.connect(new StdioServerTransport());
