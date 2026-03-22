import { getApiDocs } from "@/lib/swagger";
import ReactSwagger from "./react-swagger";

export default async function ApiDocPage() {
  const spec = await getApiDocs();
  
  return (
    <section className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
        <p className="text-gray-600">
          Interactive API documentation for Research Copilot. 
          You can test APIs directly in the browser.
        </p>
      </div>
      <ReactSwagger spec={spec} />
    </section>
  );
}
