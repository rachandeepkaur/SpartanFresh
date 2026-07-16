"""Pipeline: translate -> freshness -> prioritize -> brief, wired as a
LangGraph StateGraph so each stage is a swappable node (e.g. slot the
forecast agent in beside freshness later without touching the rest).
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from briefing import generate_briefs
from freshness import estimate_freshness
from prioritization import prioritize
from schemas import Brief, CanonicalEvent, FreshnessTag, PriorityEntry
from translation import translate


class PipelineState(TypedDict):
    raw_records: list[tuple[str, dict]]
    events: list[CanonicalEvent]
    freshness_tags: list[FreshnessTag]
    ranked: list[PriorityEntry]
    briefs: list[Brief]


def translate_node(state: PipelineState) -> dict:
    events = [translate(source, raw) for source, raw in state["raw_records"]]
    return {"events": events}


def freshness_node(state: PipelineState) -> dict:
    tags = [estimate_freshness(event) for event in state["events"]]
    return {"freshness_tags": tags}


def prioritize_node(state: PipelineState) -> dict:
    ranked = prioritize(state["events"], state["freshness_tags"])
    return {"ranked": ranked}


def brief_node(state: PipelineState) -> dict:
    briefs = generate_briefs(state["ranked"])
    return {"briefs": briefs}


def build_graph():
    graph = StateGraph(PipelineState)
    graph.add_node("translate", translate_node)
    graph.add_node("freshness", freshness_node)
    graph.add_node("prioritize", prioritize_node)
    graph.add_node("brief", brief_node)

    graph.add_edge(START, "translate")
    graph.add_edge("translate", "freshness")
    graph.add_edge("freshness", "prioritize")
    graph.add_edge("prioritize", "brief")
    graph.add_edge("brief", END)

    return graph.compile()


PIPELINE = build_graph()


def run_pipeline(raw_records: list[tuple[str, dict]]) -> PipelineState:
    return PIPELINE.invoke({"raw_records": raw_records})
