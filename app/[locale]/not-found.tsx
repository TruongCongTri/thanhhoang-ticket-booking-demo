import ErrorScreen from "@/components/errors/ErrorScreen";

/**
 * 404 inside a language: a company page that doesn't exist (/vi/abc), a slug
 * in the wrong language (/vi/about), or anything that calls notFound().
 * Next serves it with a 404 status and noindex.
 */
export default function NotFound() {
  return <ErrorScreen kind="notFound" />;
}
