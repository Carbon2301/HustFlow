import { Sidebar } from "../_components/sidebar";

const OrganizationLayout = ({
    children
}: {
    children: React.ReactNode
}) => {
  return (
    <main className="pt-20 px-4 md:px-6 w-full max-w-none">
        <div className="flex gap-x-8">
            <div className="w-72 shrink-0 hidden md:block">
                <div className="sticky top-20 pt-2 pb-6 pr-2 border-r border-neutral-100 min-h-[calc(100vh-5rem)]">
                    <Sidebar />
                </div>
            </div>
            <div className="flex-1 min-w-0 pt-2 pb-10">
                {children}
            </div>
        </div>
    </main>
    );
}

export default OrganizationLayout;
