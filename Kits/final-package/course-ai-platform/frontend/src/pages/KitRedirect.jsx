import React from "react"; // eslint-disable-line no-unused-vars
import { Navigate, useParams } from "react-router-dom";
import { pricingPathForKitSlug } from "../lib/kitLinks";

// Landing for the marketing site's "Explore Kit" links (/kits/<slug>). It sends
// the visitor to the pricing page with that kit highlighted, so the link never
// opens a blank page. Unknown slugs fall back to the plain pricing page.
export default function KitRedirect() {
  const { kitSlug } = useParams();
  return <Navigate to={pricingPathForKitSlug(kitSlug)} replace />;
}
