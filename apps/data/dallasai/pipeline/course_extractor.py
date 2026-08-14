import json
import re
from pathlib import Path

from bs4 import BeautifulSoup
from html_to_markdown import ConversionOptions, convert
from pydantic import BaseModel


class ParseException(Exception):
    pass


class Course(BaseModel):
    subject: str
    number: str
    title: str
    description: str
    credits: int
    content: str


class Program(BaseModel):
    title: str
    locations: list[str]
    degree_code: str | None = None
    description: str
    content: str


def convert_html_snippet_to_markdown(html_snippet: str) -> str:
    html = f"<html><body>{html_snippet}</body></html>"
    markdown = convert(
        html,
        options=ConversionOptions(
            extract_metadata=False,
            extract_images=False,
        ),
    )
    content = markdown.content
    if not content:
        raise ParseException("No content found in course HTML")

    return re.sub(r"\n+(?!#)", "\n", content).strip()


def parse_course_html(html: str) -> Course:
    course_pattern = re.compile(
        r"^([A-Z]+) ([\dX]+) - (.*?) \((\d+(?:-\d)?) Credit Hours?\)"
    )

    soup = BeautifulSoup(html, "html.parser")
    node = soup.find(id="course_preview_title")
    if not node:
        raise ParseException("No course found in HTML")

    content_tag = node.find_parent("td", class_="block_content")
    if not content_tag:
        raise ParseException("No course content found in HTML")

    for c in content_tag.find_all(["span", "table", "hr"]):
        c.decompose()

    for c in content_tag.find_all("a"):
        c.name = "span"
        c.attrs = {}

    for c in content_tag.children:
        text = c.get_text(strip=True)
        if not text or "javascript" in text:
            c.decompose()

    content_tag.name = "div"
    content = convert_html_snippet_to_markdown(content_tag.prettify())

    lines = content.splitlines()
    first_line = lines[0].strip("#").strip()
    match = course_pattern.match(first_line)
    if not match:
        raise ParseException(f"Invalid course format: {first_line}")

    try:
        return Course(
            subject=match.group(1),
            number=match.group(2),
            title=match.group(3),
            description=lines[2].strip(),
            credits=int(match.group(4)),
            content=content,
        )
    except ValueError as e:
        raise ParseException(f"Invalid credits format: {match.group(4)}") from e


def parse_program_html(html: str) -> Program:
    soup = BeautifulSoup(html, "html.parser")
    node = soup.select_one("td.block_content table")

    if not node:
        raise ParseException("No program found in HTML")

    program_title_node = node.find(id="acalog-page-title")
    if not program_title_node:
        raise ParseException("No program title found in HTML")
    program_title = program_title_node.get_text(strip=True)

    program_locations = []
    program_location_nodes = node.find_all(class_="acalog-location-name")
    for location in program_location_nodes:
        program_locations.append(location.get_text(strip=True))
    if not program_locations:
        raise ParseException("No program locations found in HTML")

    program_description_node = node.find(
        class_="program_description",
        recursive=True,
    )
    if not program_description_node:
        raise ParseException("No program description found in HTML")
    for c in program_description_node.find_all("a"):
        text = c.get_text(strip=True)
        if "javascript" in c.attrs.get("href", ""):
            c.decompose()
        elif "opens a new window" in text:
            c.decompose()
        else:
            c.name = "span"
            c.attrs = {}
    program_description = convert_html_snippet_to_markdown(
        program_description_node.prettify()
    )

    for c in node.children:
        text = c.get_text(strip=True)
        if not text:
            c.decompose()

    for c in node.find_all("a"):
        text = c.get_text(strip=True)
        if "javascript" in c.attrs.get("href", ""):
            c.decompose()
        elif "opens a new window" in text:
            c.decompose()
        else:
            c.name = "span"
            c.attrs = {}

    for c in node.select("div.table-responsive table.table_default"):
        c.decompose()

    for c in node.find_all("tbody"):
        if c.parent:
            c.parent.extend(c.children)
        c.decompose()

    for c in node.find_all(["tr", "td"]):
        c.name = "div"
        c.append(soup.new_tag("br"))

    node.name = "div"

    content = convert_html_snippet_to_markdown(node.prettify())

    match = re.compile(r"Degree (?:Plan )?Code:\s*([A-Z\d\._+]+)", re.MULTILINE).search(
        program_description
    )
    degree_code = None
    if match and len(match.group(1)) > 4:
        degree_code = match.group(1)

    return Program(
        content=content,
        title=program_title,
        degree_code=degree_code,
        locations=program_locations,
        description=program_description,
    )


directory = Path("/Users/david/temp/catalog/2026-2027")

programs_dir = directory / "programs"
with open("/Users/david/temp/programs.jsonl", "w") as fp:
    for file in programs_dir.glob("*.html"):
        try:
            program = parse_program_html(file.read_text(encoding="utf-8"))
            data = program.model_dump(mode="json")
            data["source_file"] = file.name
            fp.write(json.dumps(data) + "\n")
        except ParseException as e:
            print(f"Error parsing program in file {file.name}: {e}")


courses_dir = directory / "courses"
with open("/Users/david/temp/courses.jsonl", "w") as fp:
    for file in courses_dir.glob("*.html"):
        try:
            course = parse_course_html(file.read_text(encoding="utf-8"))
            data = course.model_dump(mode="json")
            data["source_file"] = file.name
            fp.write(json.dumps(data) + "\n")
        except ParseException as e:
            print(f"Error parsing course in file {file.name}: {e}")
