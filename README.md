# Google Routes API MCP Server (with Geocoding)

This project is a simple MCP (Model Context Protocol) server that integrates with the **Google Maps Geocoding API** and **Routes API** to compute directions between two addresses.

You can find all the details and the story behind it in my blog post: [Building My First MCP Server: A Practical Guide with Google Routes API](https://www.workingsoftware.dev/building-my-first-mcp-server-a-practical-guide-with-google-routes-api/)

## Features

- MCP server with [Model Context Protocol](https://modelcontextprotocol.dev/)
- Accepts **origin** and **destination addresses**
- Uses **[Google Geocoding API](https://developers.google.com/maps/documentation/geocoding/overview?hl=de)** to get coordinates
- Computes routes with **[Google Routes API](https://developers.google.com/maps/documentation/routes?hl=de)**
- Supports travel mode, routing preference, units, and alternative routes

## Example mcp.json to use it in LM Studio or Claude Desktop

```json
{
  "mcpServers": {
    "google-routes-api": {
      "command": "npx",
      "args": [
        "ts-node",
        "[path to the local repo]/src/server.ts"
      ],
      "env": {
        "GOOGLE_MAPS_API_KEY": "[your api key]"
      }
    }
  }
}
```