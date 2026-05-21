#!/bin/bash

# ============================================================
# OnlineJobs.ph Job Scraper (Duplicate Labeling Version)
# ============================================================
# This script scrapes job details from OnlineJobs.ph URLs
# and outputs them in CSV format. Duplicate URLs are labeled
# in the CONTACT PERSON field as: duplicate, duplicate-2, etc.
#
# Requirements: curl, grep, sed, awk (standard in most Linux/WSL)
#
# Usage: ./ojph_scraper.sh input.csv output.csv
# ============================================================

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DELAY_BETWEEN_REQUESTS=2  # Seconds between requests (be polite to server)
USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
MAX_RETRIES=3

# Check arguments
if [ "$#" -lt 1 ]; then
    echo -e "${YELLOW}Usage: $0 <input_csv> [output_csv]${NC}"
    echo -e "  input_csv  - CSV file with URLs in the last column"
    echo -e "  output_csv - Output file (default: output_jobs.csv)"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="${2:-output_jobs.csv}"
TEMP_DIR=$(mktemp -d)
LOG_FILE="scraper_log_$(date +%Y%m%d_%H%M%S).txt"

# Cleanup function
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to escape CSV fields
escape_csv() {
    local field="$1"
    field=$(echo "$field" | tr -d '\000')
    field=$(echo "$field" | tr '\n\r' '  ')
    field="${field//\"/\"\"}"
    echo "\"$field\""
}

# Function to decode HTML entities
decode_html() {
    local text="$1"
    text=$(echo "$text" | sed 's/&amp;/\&/g')
    text=$(echo "$text" | sed 's/&lt;/</g')
    text=$(echo "$text" | sed 's/&gt;/>/g')
    text=$(echo "$text" | sed 's/&quot;/"/g')
    text=$(echo "$text" | sed "s/&#39;/'/g")
    text=$(echo "$text" | sed 's/&nbsp;/ /g')
    text=$(echo "$text" | sed 's/&#x27;/'"'"'/g')
    text=$(echo "$text" | sed 's/&#x2F;/\//g')
    text=$(echo "$text" | sed 's/&#40;/(/g')
    text=$(echo "$text" | sed 's/&#41;/)/g')
    echo "$text"
}

# Function to clean text (remove extra whitespace, HTML tags)
clean_text() {
    local text="$1"
    text=$(echo "$text" | sed 's/<[^>]*>//g')
    text=$(echo "$text" | sed 's/<br[^>]*>/\n/gi')
    text=$(echo "$text" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    text=$(decode_html "$text")
    text=$(echo "$text" | tr -s ' ')
    echo "$text"
}

# Function to extract all four job info fields from the card structure
extract_job_info_fields() {
    local html="$1"

    local card_section
    card_section=$(echo "$html" | grep -Pzo '(?s)<div class="card job-post[^"]*"[^>]*>.*?</div>\s*</div>\s*</div>' 2>/dev/null | tr '\0' '\n')

    local values
    values=$(echo "$card_section" | grep -oP '(?<=<p class="fs-18">)[^<]+' | sed 's/^ *//;s/ *$//')

    local work_type salary hours date_updated
    work_type=$(echo "$values" | sed -n '1p')
    salary=$(echo "$values" | sed -n '2p')
    hours=$(echo "$values" | sed -n '3p')
    date_updated=$(echo "$values" | sed -n '4p')

    echo "${work_type}|${salary}|${hours}|${date_updated}"
}

# Function to fetch and parse a single job URL
scrape_job() {
    local url="$1"
    local html_file="$TEMP_DIR/page.html"

    local retry=0
    while [ $retry -lt $MAX_RETRIES ]; do
        if curl -s -L -A "$USER_AGENT" \
            -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" \
            -H "Accept-Language: en-US,en;q=0.5" \
            --connect-timeout 30 \
            --max-time 60 \
            -o "$html_file" "$url" 2>/dev/null; then

            if [ -s "$html_file" ] && grep -q "onlinejobs" "$html_file" 2>/dev/null; then
                break
            fi
        fi

        retry=$((retry + 1))
        if [ $retry -lt $MAX_RETRIES ]; then
            echo -e "${YELLOW}  Retry $retry/$MAX_RETRIES...${NC}" >&2
            sleep 2
        fi
    done

    if [ ! -s "$html_file" ]; then
        echo "ERROR|ERROR|ERROR|ERROR|ERROR|ERROR|ERROR"
        return 1
    fi

    local html_content
    html_content=$(cat "$html_file")

    local contact_person="N/A"

    local job_title=""
    job_title=$(echo "$html_content" | grep -oP '(?<=<h1 class="fs-24 fw-600 text-white text-center mb-40 job__title">)[^<]+' | head -1)
    if [ -z "$job_title" ]; then
        job_title=$(echo "$html_content" | grep -oP '(?<=<h1[^>]*class="[^"]*job[^"]*"[^>]*>)[^<]+' | head -1)
    fi
    job_title=$(clean_text "$job_title")
    [ -z "$job_title" ] && job_title="N/A"

    local job_info_fields
    job_info_fields=$(extract_job_info_fields "$html_content")

    local work_type salary hours date_updated
    IFS='|' read -r work_type salary hours date_updated <<< "$job_info_fields"

    work_type=$(clean_text "$work_type")
    [ -z "$work_type" ] && work_type="N/A"

    salary=$(clean_text "$salary")
    [ -z "$salary" ] && salary="N/A"

    hours=$(clean_text "$hours")
    [ -z "$hours" ] && hours="N/A"

    date_updated=$(clean_text "$date_updated")
    [ -z "$date_updated" ] && date_updated="N/A"

    local message=""
    message=$(echo "$html_content" | grep -Pzo '(?s)<p id="job-description"[^>]*>.*?</p>' 2>/dev/null | tr '\0' '\n')
    if [ -z "$message" ]; then
        message=$(echo "$html_content" | grep -Pzo '(?s)<p class="job-description"[^>]*>.*?</p>' 2>/dev/null | tr '\0' '\n')
    fi

    message=$(echo "$message" | sed 's/<p[^>]*>//;s/<\/p>//')
    message=$(echo "$message" | sed 's/<br[^>]*>/ /gi')
    message=$(echo "$message" | sed 's/<[^>]*>//g')
    message=$(decode_html "$message")
    message=$(echo "$message" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -s ' ')
    
    [ -z "$message" ] && message="N/A"

    echo "$contact_person|$work_type|$salary|$hours|$date_updated|$message|$job_title"
}

# Function to generate duplicate label based on occurrence count
# 1st occurrence = normal (no label change)
# 2nd occurrence = "duplicate"
# 3rd occurrence = "duplicate-2"
# 4th occurrence = "duplicate-3", and so on
get_duplicate_label() {
    local occurrence="$1"  # 1-based count of how many times this URL has appeared
    if [ "$occurrence" -eq 1 ]; then
        echo ""  # Not a duplicate
    elif [ "$occurrence" -eq 2 ]; then
        echo "duplicate"
    else
        echo "duplicate-$((occurrence - 1))"
    fi
}

# Main execution
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  OnlineJobs.ph Job Scraper (Duplicate Labeling)${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}Error: Input file '$INPUT_FILE' not found!${NC}"
    exit 1
fi

log "Starting scraper..."
log "Input file: $INPUT_FILE"
log "Output file: $OUTPUT_FILE"

# -------------------------------------------------------
# First pass: collect all rows (preserving order) with
# their URL and whether they need scraping.
# We store: url|line_content for each non-header row.
# -------------------------------------------------------
declare -a all_rows        # Stores each data line in order
declare -A url_count       # Tracks how many times each URL appears
declare -A url_scraped     # Tracks if URL has already been scraped (stores result)
declare -A url_needs_scrape # Whether a URL still needs scraping

line_num=0
while IFS= read -r line || [ -n "$line" ]; do
    line_num=$((line_num + 1))

    # Skip header line
    if [ $line_num -eq 1 ] && echo "$line" | grep -qi "CONTACT PERSON"; then
        continue
    fi

    # Skip empty lines
    [ -z "$line" ] && continue

    # Extract URL from the line
    url=$(echo "$line" | grep -oP 'https://www\.onlinejobs\.ph/[^\s,"]+')

    if [ -n "$url" ]; then
        # Increment occurrence count for this URL
        url_count[$url]=$(( ${url_count[$url]:-0} + 1 ))

        # Check if MESSAGE field (6th field) has content
        message_field=$(echo "$line" | awk -F',' '{
            gsub(/^[ \t]*/, "", $6)
            gsub(/[ \t]*$/, "", $6)
            print $6
        }')

        # Mark as needing scrape only on first occurrence if MESSAGE is empty
        if [ "${url_count[$url]}" -eq 1 ]; then
            if [[ -z "$message_field" ]] || [[ "$message_field" =~ ^\"\"$ ]] || [[ "$message_field" =~ ^[[:space:]]*$ ]]; then
                url_needs_scrape[$url]=1
            else
                url_needs_scrape[$url]=0
            fi
        fi

        # Store the row with its URL for second pass
        all_rows+=("$url|||||$line")
    fi
done < "$INPUT_FILE"

total_urls=${#url_count[@]}
total_rows=${#all_rows[@]}
total_duplicates=$(( total_rows - total_urls ))
urls_to_scrape=()
for url in "${!url_needs_scrape[@]}"; do
    [ "${url_needs_scrape[$url]}" -eq 1 ] && urls_to_scrape+=("$url")
done
total_to_scrape=${#urls_to_scrape[@]}

echo -e "${GREEN}Total rows (excluding header):  $total_rows${NC}"
echo -e "${GREEN}Unique URLs:                    $total_urls${NC}"
echo -e "${YELLOW}Duplicate rows:                 $total_duplicates${NC}"
echo -e "${BLUE}URLs needing scrape:            $total_to_scrape${NC}"
echo ""

# -------------------------------------------------------
# Scrape all URLs that need it (only once per unique URL)
# -------------------------------------------------------
processed=0
for url in "${urls_to_scrape[@]}"; do
    processed=$((processed + 1))
    echo -e "${BLUE}[$processed/$total_to_scrape] Scraping:${NC} $url"

    result=$(scrape_job "$url")

    if [ $? -eq 0 ] && [ "$result" != "ERROR|ERROR|ERROR|ERROR|ERROR|ERROR|ERROR" ]; then
        url_scraped[$url]="$result"
        IFS='|' read -r _cp _wt _sal _hrs _date _msg _title <<< "$result"
        echo -e "  ${GREEN}✓ Success${NC} - Title: $_title | Type: $_wt | Salary: $_sal"
        log "SUCCESS: $url"
    else
        url_scraped[$url]="N/A|N/A|N/A|N/A|N/A|Failed to scrape|N/A"
        echo -e "  ${RED}✗ Failed${NC}"
        log "FAILED: $url"
    fi

    percent=$((processed * 100 / total_to_scrape))
    echo -e "  ${YELLOW}Progress: $percent%${NC}"

    if [ $processed -lt $total_to_scrape ]; then
        sleep $DELAY_BETWEEN_REQUESTS
    fi
done

# -------------------------------------------------------
# Write output — second pass over all_rows in order,
# tracking per-URL occurrence to generate duplicate labels
# -------------------------------------------------------
echo "CONTACT PERSON,TYPE OF WORK,WAGE / SALARY,HOURS PER WEEK,DATE UPDATED,MESSAGE,URL,Job Title" > "$OUTPUT_FILE"

declare -A url_occurrence  # Per-URL write counter

for row_entry in "${all_rows[@]}"; do
    # Extract the URL (everything before the first "|||||")
    url="${row_entry%%|||||*}"
    original_line="${row_entry#*|||||}"

    # Increment occurrence count for output tracking
    url_occurrence[$url]=$(( ${url_occurrence[$url]:-0} + 1 ))
    occurrence=${url_occurrence[$url]}

    # Determine duplicate label
    dup_label=$(get_duplicate_label "$occurrence")

    if [ "${url_needs_scrape[$url]}" -eq 0 ]; then
        # -------------------------------------------------
        # This URL had existing data — preserve original line
        # but patch CONTACT PERSON if it's a duplicate row
        # -------------------------------------------------
        if [ -z "$dup_label" ]; then
            echo "$original_line" >> "$OUTPUT_FILE"
            log "PRESERVED (original): $url"
        else
            # Replace CONTACT PERSON field (field 1) with duplicate label
            patched_line=$(echo "$original_line" | awk -v lbl="\"$dup_label\"" 'BEGIN{FS=OFS=","} {$1=lbl; print}')
            echo "$patched_line" >> "$OUTPUT_FILE"
            echo -e "  ${YELLOW}Labeled duplicate ($dup_label): $url${NC}"
            log "PRESERVED (${dup_label}): $url"
        fi
    else
        # -------------------------------------------------
        # This URL was scraped — use scraped data
        # -------------------------------------------------
        result="${url_scraped[$url]}"
        IFS='|' read -r contact_person work_type salary hours date_updated message job_title <<< "$result"

        # Override CONTACT PERSON with duplicate label if applicable
        if [ -n "$dup_label" ]; then
            contact_person="$dup_label"
        fi

        contact_person=$(escape_csv "$contact_person")
        work_type=$(escape_csv "$work_type")
        salary=$(escape_csv "$salary")
        hours=$(escape_csv "$hours")
        date_updated=$(escape_csv "$date_updated")
        message=$(escape_csv "$message")
        url_escaped=$(escape_csv "$url")
        job_title=$(escape_csv "$job_title")

        echo "$contact_person,$work_type,$salary,$hours,$date_updated,$message,$url_escaped,$job_title" >> "$OUTPUT_FILE"

        if [ -n "$dup_label" ]; then
            echo -e "  ${YELLOW}Written as duplicate ($dup_label): $url${NC}"
            log "WRITTEN (${dup_label}): $url"
        else
            log "WRITTEN (original): $url"
        fi
    fi
done

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}Scraping Complete!${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "  Total rows written:     $total_rows"
echo -e "  Unique URLs:            $total_urls"
echo -e "  Duplicate rows labeled: $total_duplicates"
echo -e "  URLs scraped:           $processed"
echo -e "  Output file:            $OUTPUT_FILE"
echo -e "  Log file:               $LOG_FILE"
echo ""

log "Complete. Rows: $total_rows | Unique: $total_urls | Duplicates labeled: $total_duplicates | Scraped: $processed"