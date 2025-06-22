#!/usr/bin/env node
import { PuppeteerScraper } from "@missionsquad/puppeteer-scraper";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { NodeHtmlMarkdown } from "node-html-markdown";

console.error('MCP-SearXNG: Starting up...');

// Use a static version string that will be updated by the version script
const packageVersion = "0.5.5";

const WEB_SEARCH_TOOL: Tool = {
  name: "web_search",
  description:
    "Performs a web search using the SearXNG API, ideal for general queries, news, articles, and online content. " +
    "Use this for broad information gathering, recent events, or when you need diverse web sources.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "The search query. This is the main input for the web search",
      },
      pageno: {
        type: "number",
        description: "Search page number (starts at 1)",
        default: 1,
      },
      count: {
        type: "number",
        description: "Number of results per page (default: 10)",
        default: 10,
      },
      time_range: {
        type: "string",
        description: "Time range of search (day, month, year)",
        enum: ["day", "month", "year"],
      },
      language: {
        type: "string",
        description:
          "Language code for search results (e.g., 'en', 'fr', 'de'). Default is instance-dependent.",
      },
      safesearch: {
        type: "string",
        description:
          "Safe search filter level (0: None, 1: Moderate, 2: Strict) (default: 0)",
        enum: ["0", "1", "2"],
      },
    },
    required: ["query"],
  },
};

const READ_URL_TOOL: Tool = {
  name: "get_url_content",
  description:
    "Get the content of a URL. " +
    "Use this for further information retrieving to understand the content of each URL.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL",
      },
    },
    required: ["url"],
  },
};

// Server implementation
const server = new Server(
  {
    name: "@missionsquad/mcp-searxng-puppeteer",
    version: packageVersion,
  },
  {
    capabilities: {
      resources: {},
      tools: {
        web_search: {
          description: WEB_SEARCH_TOOL.description,
          schema: WEB_SEARCH_TOOL.inputSchema,
        },
        get_url_content: {
          description: READ_URL_TOOL.description,
          schema: READ_URL_TOOL.inputSchema,
        },
      },
    },
  }
);

interface SearXNGWeb {
  results: Array<{
    title: string;
    content: string;
    url: string;
  }>;
}

function isSearXNGWebSearchArgs(args: unknown): args is {
  query: string;
  pageno?: number;
  count?: number;
  time_range?: string;
  language?: string;
  safesearch?: string;
} {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

async function performWebSearch(
  query: string,
  pageno: number = 1,
  count: number = 10,
  time_range?: string,
  language: string = "all",
  safesearch?: string
) {
  const searxngUrl = process.env.SEARXNG_URL || "http://localhost:8080";
  const url = new URL(`${searxngUrl}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("pageno", pageno.toString());
  url.searchParams.set("count", count.toString());

  if (
    time_range !== undefined &&
    ["day", "month", "year"].includes(time_range)
  ) {
    url.searchParams.set("time_range", time_range);
  }

  if (language && language !== "all") {
    url.searchParams.set("language", language);
  }

  if (safesearch !== undefined && ["0", "1", "2"].includes(safesearch)) {
    url.searchParams.set("safesearch", safesearch);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(
      `SearXNG API error: ${response.status} ${
        response.statusText
      }\n${await response.text()}`
    );
  }

  const data = (await response.json()) as SearXNGWeb;

  const results = (data.results || []).map((result) => ({
    title: result.title || "",
    content: result.content || "",
    url: result.url || "",
  }));

  return results
    .map((r) => `Title: ${r.title}\nDescription: ${r.content}\nURL: ${r.url}`)
    .join("\n\n");
}
/**
 * export interface ScraperOptions {
    headless?: boolean;
    ignoreHTTPSErrors?: boolean;
    proxyUrl?: string;
    blockResources?: boolean;
    cacheSize: number;
    enableGPU?: boolean;
}
 */
// Defer scraper initialization to avoid blocking startup
let scraper: PuppeteerScraper | null = null
let scraperReady = false

const MAX_PUPPETEER_RETRIES = 5
const INITIAL_RETRY_DELAY_MS = 15000 // 15 seconds

async function initializePuppeteerWithRetries(retryCount = 0) {
  try {
    console.error(
      `MCP-SearXNG: Starting Puppeteer initialization (Attempt ${
        retryCount + 1
      }/${MAX_PUPPETEER_RETRIES})...`
    );
    scraper = new PuppeteerScraper({
      headless: true,
      ignoreHTTPSErrors: true,
      blockResources: false,
      cacheSize: 1000,
      enableGPU: false
    })
    await scraper.init()
    scraperReady = true
    console.error('MCP-SearXNG: Puppeteer initialized successfully.')
  } catch (error) {
    console.error(`MCP-SearXNG: Failed to initialize Puppeteer on attempt ${retryCount + 1}:`, error)
    if (retryCount < MAX_PUPPETEER_RETRIES - 1) {
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount)
      console.error(`MCP-SearXNG: Retrying in ${delay / 1000} seconds...`);
      setTimeout(() => initializePuppeteerWithRetries(retryCount + 1), delay)
    } else {
      console.error('MCP-SearXNG: Max retries reached. Puppeteer initialization failed permanently for this session.')
      // scraperReady will remain false, and the tool will report an error.
    }
  }
}

async function fetchAndConvertToMarkdown(url: string, timeoutMs: number = 10000) {
  if (!scraperReady || !scraper) {
    throw new Error('Puppeteer is not ready. Please try again in a few moments.')
  }

  try {
    const response = await scraper.scrapePage(url)

    if (response == null) {
      throw new Error(`Failed to fetch the URL: ${url}`)
    }

    const { content } = response
    return content.text
  } catch (error: any) {
    console.error('Error during scrape:', error.message)
    throw error
  }
}
// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [WEB_SEARCH_TOOL, READ_URL_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("No arguments provided");
    }

    if (name === "web_search") {
      if (!isSearXNGWebSearchArgs(args)) {
        throw new Error("Invalid arguments for web_search");
      }
      const {
        query,
        pageno = 1,
        count = 10,
        time_range,
        language = "all",
        safesearch,
      } = args;
      const results = await performWebSearch(
        query,
        pageno,
        count,
        time_range,
        language,
        safesearch
      );
      return {
        content: [{ type: "text", text: results }],
        isError: false,
      };
    }

    if (name === "get_url_content") {
      if (!scraperReady) {
        return {
          content: [
            {
              type: 'text',
              text: 'Tool not ready: Puppeteer is still initializing. Please try again in a few moments.'
            }
          ],
          isError: true
        }
      }
      const { url } = args
      const result = await fetchAndConvertToMarkdown(url as string)
      return {
        content: [{ type: 'text', text: result }],
        isError: false
      }
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Start puppeteer initialization in the background with retries
  initializePuppeteerWithRetries()
}

runServer().catch(error => {
  console.error("MCP-SearXNG: Fatal error running server:", error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('MCP-SearXNG: Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('MCP-SearXNG: Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
