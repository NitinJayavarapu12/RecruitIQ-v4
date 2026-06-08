import re
import requests
from typing import Optional
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def scrape_linkedin_job(url: str) -> Optional[str]:
    """Scrape job description from a LinkedIn job posting URL."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # LinkedIn job description container
        selectors = [
            "div.description__text",
            "div.show-more-less-html__markup",
            "section.description",
            "div[class*='description']",
        ]
        for selector in selectors:
            el = soup.select_one(selector)
            if el:
                text = el.get_text(separator="\n").strip()
                if len(text) > 200:
                    return _clean_text(text)

        return None
    except Exception as e:
        print(f"[JD_SCRAPER] LinkedIn scrape failed: {e}")
        return None


def scrape_naukri_job(url: str) -> Optional[str]:
    """Scrape job description from a Naukri job posting URL."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        selectors = [
            "div.job-desc",
            "div[class*='job-desc']",
            "section.job-desc",
            "div.dsc",
            "div[class*='description']",
            "div.jobDescriptionWrapper",
        ]
        for selector in selectors:
            el = soup.select_one(selector)
            if el:
                text = el.get_text(separator="\n").strip()
                if len(text) > 200:
                    return _clean_text(text)

        return None
    except Exception as e:
        print(f"[JD_SCRAPER] Naukri scrape failed: {e}")
        return None


def scrape_job_url(url: str) -> Optional[str]:
    """Detect platform from URL and scrape accordingly."""
    if "linkedin.com" in url:
        return scrape_linkedin_job(url)
    elif "naukri.com" in url:
        return scrape_naukri_job(url)
    else:
        # Generic fallback for other URLs
        return _generic_scrape(url)


def _generic_scrape(url: str) -> Optional[str]:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for tag in soup(["script", "style", "nav", "header", "footer"]):
            tag.decompose()

        text = soup.get_text(separator="\n").strip()
        return _clean_text(text) if len(text) > 200 else None
    except Exception as e:
        print(f"[JD_SCRAPER] Generic scrape failed: {e}")
        return None


def _clean_text(text: str) -> str:
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    # Remove consecutive duplicates
    cleaned = []
    for line in lines:
        if not cleaned or line != cleaned[-1]:
            cleaned.append(line)
    return "\n".join(cleaned)
