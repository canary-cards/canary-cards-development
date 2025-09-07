import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Header } from "@/components/Header";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
        <h1 className="text-4xl display-title mb-4">404</h1>
        <p className="text-xl body-text text-muted-foreground mb-4">Oops! Page not found</p>
        <a href="/" className="text-primary hover:text-primary/80 underline">
          Return to Home
        </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
