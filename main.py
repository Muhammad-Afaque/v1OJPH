import requests
from bs4 import BeautifulSoup

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://www.onlinejobs.ph/",
}

url = "https://www.onlinejobs.ph/jobseekers/jobsearch"
response = requests.get(url, headers=headers)
soup = BeautifulSoup(response.text, "html.parser")

jobs = []

for card in soup.select(".jobpost-cat-box"):

    # Company (logo alt text — N/A if no logo)
    logo = card.select_one("img.jobpost-cat-box-logo")
    company = logo["alt"].strip() if logo else "N/A"

    # Job type — read BEFORE decompose
    title_tag = card.select_one("h4.fs-16.fw-700")
    if title_tag:
        badge_tag = title_tag.find("span", class_="badge")
        job_type = badge_tag.get_text(strip=True) if badge_tag else "N/A"
        if badge_tag:
            badge_tag.decompose()  # remove after reading
        title = title_tag.get_text(strip=True)
    else:
        title    = "N/A"
        job_type = "N/A"

    # Salary
    salary_tag = card.select_one("dl.row.no-gutters dd.col")
    salary = salary_tag.get_text(strip=True) if salary_tag else "N/A"

    # Posted date
    date_tag = card.select_one("p.fs-13.mb-0 em")
    posted = date_tag.get_text(strip=True).replace("Posted on ", "") if date_tag else "N/A"

    # Job URL
    link_tag = card.select_one("div.desc a[href^='/jobseekers/job/']")
    job_url = "https://www.onlinejobs.ph" + link_tag["href"] if link_tag else "N/A"

    # Tags
    tags = [a.get_text(strip=True) for a in card.select("div.job-tag a.badge") if a.get_text(strip=True)]

    jobs.append({
        "title":   title,
        "company": company,
        "type":    job_type,
        "salary":  salary,
        "posted":  posted,
        "url":     job_url,
        "tags":    tags,
    })

for job in jobs:
    print(job)