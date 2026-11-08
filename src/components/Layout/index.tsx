import styled from "styled-components";
import { useEffect, useRef } from "react";
import Sidebar from "../Sidebar";
import SEO from "../SEO";
import Assistant from "../Assistant";
import { Outlet, useLocation } from "react-router-dom";

const Container = styled.div`
    display: flex;
    flex-direction: row;
    gap: 12px;
    height: calc(100vh - 20px);
    width: calc(100vw - 20px);
    margin: 10px 5px;
    box-sizing: border-box;

    @media (max-width: 768px) {
        flex-direction: column;
        height: auto;
        width: 100%;
        margin: 0;
    }
`;

const MainContent = styled.main`
    flex: 1;
    min-width: 0;
    background-color: #fbfcf8;
    border: 1px solid #dce5dc;
    border-radius: 8px;
    padding: 32px;
    overflow: auto;

    @media (max-width: 768px) {
        padding: 16px;
        margin-top: 8px;
    }
`;

const Layout = () => {
    const { pathname } = useLocation();
    const main = useRef<HTMLElement>(null);
    useEffect(() => {
        main.current?.scrollTo({ top: 0 });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    }, [pathname]);
    const sidebarSections = [
        { title: "Relocation", items: [
            { href: "/", alt: "Discover ColCalc" },
            { href: "/app", alt: "My relocation" },
            { href: "/onboarding", alt: "Build a plan" },
        ] },
        { title: "Explore tools", items: [
            { href: "/calculator", alt: "Calculator" },
            { href: "/cities-comparison", alt: "Cities comparison" },
            { href: "/purchasing-power", alt: "Purchasing power parity" },
            { href: "/tax-calculator", alt: "Tax calculator" },
        ] },
    ];

    return (
        <Container>
            <SEO />
            <Sidebar sections={sidebarSections}/>
            <MainContent ref={main}>
                <Outlet />
            </MainContent>
            <Assistant />
        </Container>
    );
};

export default Layout;