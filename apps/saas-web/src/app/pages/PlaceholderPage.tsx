import { Page } from "@factosys/ui";

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Page title={title} description={description}>
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        Contenido vacío — esqueleto S12-APP.
      </div>
    </Page>
  );
}
