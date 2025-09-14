import { Footer } from "./_components/footer";
import { Navbar } from "./_components/navbar";

const MarketingLayout = ({
    children
} : {
    children: React.ReactNode;
}) => {
    return (
        <div className="h-full bg-white">
            <Navbar />
            <main className="pt-28 pb-24 min-h-screen flex items-center justify-center">
                {children}
            </main>
            <Footer />
        </div>
    );
};

export default MarketingLayout;