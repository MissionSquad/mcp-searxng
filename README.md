# SearXNG + Puppeteer MCP Server

An [MCP server](https://modelcontextprotocol.io/introduction) implementation that integrates the [SearXNG](https://docs.searxng.org) API for powerful web search capabilities and uses `@missionsquad/puppeteer-scraper` to read and process live web content.

This server is a component of the [Mission Squad](https://missionsquad.ai) ecosystem, designed to provide reliable, agentic web browsing and information retrieval.

<a href="https://glama.ai/mcp/servers/@MissionSquad/mcp-searxng">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@MissionSquad/mcp-searxng/badge" alt="@missionsquad/mcp-searxng-puppeteer MCP server" />
</a>

## Features

- **Web Search**: Perform general queries, find news, and access articles with robust filtering.
- **URL Content Reading**: Scrape and process content from any URL, returning clean text.
- **Pagination**: Control which page of search results to retrieve.
- **Time Filtering**: Filter search results by time range (day, month, year).
- **Language Selection**: Filter results by preferred language.
- **Safe Search**: Control the content filtering level for search results.

## Tools

### `web_search`

Executes a web search using the configured SearXNG instance.

**Inputs:**
- `query` (string, required): The search query.
- `pageno` (number, optional): The search result page number to retrieve. Starts at 1. Defaults to `1`.
- `count` (number, optional): The number of results to return per page. Defaults to `10`.
- `time_range` (string, optional): Filters results by time range. Valid options are: `"day"`, `"month"`, `"year"`.
- `language` (string, optional): The language code for results (e.g., `"en"`, `"fr"`, `"de"`). Defaults to the instance's setting.
- `safesearch` (string, optional): The safe search filter level. Valid options are: `"0"` (None), `"1"` (Moderate), `"2"` (Strict). Defaults to the instance's setting.

### `get_url_content`

Reads the content from a given URL, processes it with Puppeteer, and returns the text content.

**Inputs:**
- `url` (string, required): The URL to fetch and process.

## Configuration

### Setting the `SEARXNG_URL`

This server requires a running SearXNG instance.

1.  Choose a SearxNG instance from the [list of public instances](https://searx.space/) or deploy your own.
2.  Set the `SEARXNG_URL` environment variable to the instance's URL.
3.  If not set, the server defaults to `http://localhost:8080`.

### Running SearXNG with Docker

You can run SearXNG locally using Docker.

**Docker Run Command:**

```bash
docker run --rm -d -p 8080:8080 -v ${PWD}/searxng:/etc/searxng:rw --name searxng searxng/searxng:latest
```
This command will start a SearXNG container and map it to port `8080` on your local machine.

**Docker Compose Example:**

Create a `docker-compose.yml` file with the following content:

```yaml
services:
  searxng:
    container_name: searxng
    image: docker.io/searxng/searxng:latest
    restart: unless-stopped
    ports:
      - 8081:8080
    volumes:
      - ./searxng:/etc/searxng:rw
    environment:
      - SEARXNG_BASE_URL=https://${SEARXNG_HOSTNAME:-localhost}/
      - UWSGI_WORKERS=${SEARXNG_UWSGI_WORKERS:-4}
      - UWSGI_THREADS=${SEARXNG_UWSGI_THREADS:-4}
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "2"
```

Run `docker-compose up -d` to start the service. Note that this example maps the service to port `8081`.

## Usage

### NPX

To run the server directly for development or testing:

```json
{
  "mcpServers": {
    "searxng-puppeteer": {
      "command": "npx",
      "args": ["-y", "@missionsquad/mcp-searxng-puppeteer"],
      "env": {
        "SEARXNG_URL": "YOUR_SEARXNG_INSTANCE_URL"
      }
    }
  }
}
```

### NPM

Install the package globally:

```bash
npm install -g @missionsquad/mcp-searxng-puppeteer
```

And then configure it in your MCP client:

```json
{
  "mcpServers": {
    "searxng-puppeteer": {
      "command": "mcp-searxng-puppeteer",
      "env": {
        "SEARXNG_URL": "YOUR_SEARXNG_INSTANCE_URL"
      }
    }
  }
}
```

### Docker

A Docker image will be available on Docker Hub soon. To build it locally:

```bash
docker build -t missionsquad/mcp-searxng-puppeteer:latest .
```

Then, add it to your MCP client configuration:

```json
{
  "mcpServers": {
    "searxng-puppeteer": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "SEARXNG_URL",
        "missionsquad/mcp-searxng-puppeteer:latest"
      ],
      "env": {
        "SEARXNG_URL": "YOUR_SEARXNG_INSTANCE_URL"
      }
    }
  }
}
```

## Try it on Mission Squad

You can test the `@missionsquad/mcp-searxng-puppeteer` server and other MCP servers on the [Mission Squad](https://missionsquad.ai) platform. Mission Squad is an Agentic AI Platform that allows you to build, manage, and deploy cooperative agents that connect to any model, leverage private data, and automate complex tasks. Sign up for a free account to get started.

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
