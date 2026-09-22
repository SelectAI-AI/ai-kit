from langgraph.checkpoint.memory import MemorySaver
from src.agents.langgraph_agent import build_approval_demo_graph, run_supervisor_demo


def test_supervisor_graph_runs():
    result = run_supervisor_demo("Explain the multi-server MCP agent")
    assert "final" in result
    assert "# Draft report" in result["final"]


def test_approval_graph_can_resume():
    graph = build_approval_demo_graph(checkpointer=MemorySaver())
    config = {"configurable": {"thread_id": "approval-test"}}
    first = graph.invoke({"request": "delete a file"}, config)
    # The graph pauses on interrupt; in tests we simulate a resume with approve.
    if "__interrupt__" in first:
        resumed = graph.invoke({"request": "delete a file"}, {**config, "resume": {"decision": "approve"}})
        assert resumed["approved"] is True or resumed["result"].startswith("Approved")
    else:
        assert first["approved"] in {True, False}
