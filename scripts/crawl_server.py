"""
Minimal crawl4ai Python SDK server.
Wraps AsyncWebCrawler with proper BrowserConfig so Next.js pages fully render.
"""
import os
import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
import uvicorn

app = FastAPI()

BROWSER_CFG = BrowserConfig(headless=True, verbose=False)


class CrawlRequest(BaseModel):
    url: str
    wait_for: str = "css:main"
    delay: float = 3.0
    timeout: int = 30000


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/crawl")
async def crawl_page(req: CrawlRequest):
    run_cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        wait_for=req.wait_for,
        delay_before_return_html=req.delay,
        page_timeout=req.timeout,
        verbose=False,
    )
    try:
        async with AsyncWebCrawler(config=BROWSER_CFG) as crawler:
            result = await crawler.arun(url=req.url, config=run_cfg)
            md = result.markdown
            raw = (md.raw_markdown if hasattr(md, "raw_markdown") else str(md or "")) or ""
            title = (result.metadata or {}).get("title", "")
            return {"markdown": raw, "title": title, "success": result.success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 11236))
    uvicorn.run(app, host="0.0.0.0", port=port)