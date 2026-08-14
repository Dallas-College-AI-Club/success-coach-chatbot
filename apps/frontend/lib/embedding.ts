// Server-only entry point for the local MiniLM embedder.
//
// The actual implementation lives in ./embedding-core so CLI tooling
// (scripts/probe-search.mts) can import it under plain tsx without the
// "server-only" package throwing on the react-server condition check.
// Production code paths (chat route, tools) MUST import from here — the
// guard turns any accidental client-component import into a build error.
import "server-only";

export { embedText } from "./embedding-core";
