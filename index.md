<!Doc type html>
    <html>
        <head>
            <title>Home | BookTomNYC</title>
            <meta charset="utf-8" />
            <meta content="width=device-width, initial-scale=1, maximum-scale=1" name="viewport" />
            <style>
                .loading-view {
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    position: fixed;
                    top: 0;
                    left: 0;
                    z-index: 100;
                }

                .loading-container {
                    width: 62px;
                    height: 54px;
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    grid-gap: 12px;
                }

                @media (min-width: 840px) {
                    .loading-container {
                        width: 72px;
                        height: 54px;
                        grid-gap: 12px;
                    }
                }

                .dot-container {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(#21212120, #212121);
                    /* Base64 encoded simple circle SVG /resources/assets/js/prime/src/site/components/ui/circle.svg */
                    mask-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9Ii0xIC0xIDIgMiI+Cgk8Y2lyY2xlIHI9IjEiLz4KPC9zdmc+Cg==');
                    -webkit-mask-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9Ii0xIC0xIDIgMiI+Cgk8Y2lyY2xlIHI9IjEiLz4KPC9zdmc+Cg==');
                    mask-repeat: no-repeat;
                    -webkit-mask-repeat: no-repeat;
                    mask-size: 100% auto;
                    -webkit-mask-size: 100% auto;
                    mask-position: bottom;
                    -webkit-mask-position: bottom;
                    animation: loading-view-movement;
                    animation-delay: 0s;
                    animation-duration: 3750ms;
                    animation-iteration-count: infinite;
                    animation-timing-function: cubic-bezier(0.8, 0, 0.8, 1);
                }

                .dot-container:nth-of-type(2) {
                    animation-delay: 130ms;
                }

                .dot-container:nth-of-type(3) {
                    animation-delay: 260ms;
                }

                @keyframes loading-view-movement {

                    /* up and down for 3s, stop for 750ms */
                    0%,
                    27%,
                    54% {
                        mask-position: bottom;
                        -webkit-mask-position: bottom;
                    }

                    14%,
                    41%,
                    68% {
                        mask-position: top;
                        -webkit-mask-position: top;
                    }

                    27%,
                    54%,
                    81%,
                    100% {
                        mask-position: bottom;
                        -webkit-mask-position: bottom;
                    }
                }
            </style>
            <link href="https://cdn3.editmysite.com/app/website/css/site.9d941a5dfeef33b8ae55.css" rel="stylesheet" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/home-page.49484151a4d7d8ea4cc8.css" rel="stylesheet" type="text/css" />
            <link data-vue-meta="1" href="https://booktomnyc.square.site/" rel="canonical" />
            <link data-vue-meta="1" href="/app/website/square.ico" rel="shortcut icon" type="image/x-icon" />
            <link data-vue-meta="1" href="https://ec.editmysite.com" rel="preconnect" />
            <link as="style" data-vue-meta="1" href="https://cdn3.editmysite.com/app/website/static/fonts/Roboto Slab/font.css" rel="preload" />
            <link as="style" data-vue-meta="1" href="https://cdn3.editmysite.com/app/website/static/fonts/Roboto/font.css" rel="preload" />
            <link as="style" data-vue-meta="1" href="https://cdn3.editmysite.com/app/website/static/fonts/Poppins/font.css" rel="preload" />
            <link data-vue-meta="1" href="https://cdn3.editmysite.com/app/website/static/fonts/Roboto Slab/font.css" media="all" rel="stylesheet" type="text/css" />
            <link data-vue-meta="1" href="https://cdn3.editmysite.com/app/website/static/fonts/Roboto/font.css" media="all" rel="stylesheet" type="text/css" />
            <link data-vue-meta="1" href="https://cdn3.editmysite.com/app/website/static/fonts/Poppins/font.css" media="all" rel="stylesheet" type="text/css" />
            <meta content="" data-vmid="description" data-vue-meta="1" name="description" />
            <style data-vmid="pageStyles" data-vue-meta="1" type="text/css">
                :root {
                    --base-font-siz<!Doc type html>
    <html>
        <head>
            <title>Home | BookTomNYC</title>
            <meta charset="utf-8" />
            <meta content="width=device-width, initial-scale=1, maximum-scale=1" name="viewport" />
            <style>
                .loading-view {
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    position: fixed;
                    top: 0;
                    left: 0;
                    z-index: 100;
                }

                .loading-container {
                    width: 62px;
                    height: 54px;
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    grid-gap: 12px;
                }

                @media (min-width: 840px) {
                    .loading-container {
                        width: 72px;
                        height: 54px;
                        grid-gap: 12px;
                    }
                }

                .dot-container {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(#21212120, #212121);
                    /* Base64 encoded simple circle SVG /resources/assets/js/prime/src/site/components/ui/circle.svg */
                    mask-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9Ii0xIC0xIDIgMiI+Cgk8Y2lyY2xlIHI9IjEiLz4KPC9zdmc+Cg==');
                    -webkit-mask-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9Ii0xIC0xIDIgMiI+Cgk8Y2lyY2xlIHI9IjEiLz4KPC9zdmc+Cg==');
                    mask-repeat: no-repeat;
                    -webkit-mask-repeat: no-repeat;
                    mask-size: 100% auto;
                    -webkit-mask-size: 100% auto;
                    mask-position: bottom;
                    -webkit-mask-position: bottom;
                    animation: loading-view-movement;
                    animation-delay: 0s;
                    animation-duration: 3750ms;
                    animation-iteration-count: infinite;
                    animation-timing-function: cubic-bezier(0.8, 0, 0.8, 1);
                }

                .dot-container:nth-of-type(2) {
                    animation-delay: 130ms;
                }

                .dot-container:nth-of-type(3) {
                    animation-delay: 260ms;
                }

                @keyframes loading-view-movement {

                    /* up and down for 3s, stop for 750ms */
                    0%,
                    27%,
                    54% {
                        mask-position: bottom;
                        -webkit-mask-position: bottom;
                    }

                    14%,
                    41%,
                    68% {
                        mask-position: top;
                        -webkit-mask-position: top;
                    }

                    27%,
                    54%,
                    81%,
                    100% {
                        mask-position: bottom;
                        -webkit-mask-position: bottom;
                    }
                }
            </style>
            <link href="https://cdn3.editmysite.com/app/website/css/site.9d941a5dfeef33b8ae55.css" rel="stylesheet" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/home-page.49484151a4d7d8ea4cc8.css" rel="stylesheet" type="text/css" />
            <link data-vue-meta="1" href="https://booktomnyc.square.site/" rel="canonical" />
            <link data-vue-meta="1" href="/app/website/square.ico" rel="shortcut icon" type="image/x-icon" />
            <link data-vue-meta="1" href="https://ec.editmysite.com" rel="preconnect" />
            <link as="style" data-vue-meta="1" href="https://cdn3.editmysite.com/app/website/static/fonts/Roboto Slab/font.css" rel="preload" />
            <link as="style" data-vue-meta="1" href="https://cdn3.editmysite.com/app/website/static/fonts/Roboto/font.css" rel="preload" />
            <link as="style" data-vue-meta="1" href="https://cdn3.editmysite.com/app/website/static/fonts/Poppins/font.css" rel="preload" />
            <link data-vue-meta="1" href="https://cdn3.editmysite.com/app/website/static/fonts/Roboto Slab/font.css" media="all" rel="stylesheet" type="text/css" />
            <link data-vue-meta="1" href="https://cdn3.editmysite.com/app/website/static/fonts/Roboto/font.css" media="all" rel="stylesheet" type="text/css" />
            <link data-vue-meta="1" href="https://cdn3.editmysite.com/app/website/static/fonts/Poppins/font.css" media="all" rel="stylesheet" type="text/css" />
            <meta content="" data-vmid="description" data-vue-meta="1" name="description" />
            <style data-vmid="pageStyles" data-vue-meta="1" type="text/css">
                :root {
                    --base-font-size: 30;
                    --type-scale: 2;
                    --primary-font: Roboto;
                    --secondary-font: Rotis;
                    --primary-font-weight: 500;
                    --secondary-font-weight: 400;
                    --ui-font: Roboto;
                    --ui-font-weight: 500;
                    --title-font: var(--primary-font);
                    --title-font-weight: var(--primary-font-weight);
                    --body-font: var(--secondary-font);
                    --body-font-weight: var(--secondary-font-weight);
                    --site-title-font: var(--primary-font);
                    --site-title-font-weight: var(--primary-font-weight);
                    --headline-font: var(--primary-font);
                    --headline-font-weight: var(--primary-font-weight);
                    --section-title-font: var(--primary-font);
                    --section-title-font-weight: var(--primary-font-weight);
                    --section-callout-font: var(--primary-font);
                    --section-callout-font-weight: var(--primary-font-weight);
                    --attribution-font: var(--ui-font);
                    --attribution-font-weight: var(--ui-font-weight);
                    --navigation-font: var(--ui-font);
                    --navigation-font-weight: var(--ui-font-weight);
                    --product-price-font: var(--ui-font);
                    --product-price-font-weight: var(--ui-font-weight);
                    --button-font: var(--ui-font);
                    --button-font-weight: var(--ui-font-weight);
                    --primary-color: #212121;
                    --color-secondary-minimal-black-iojGVX: #141414;
                    --color-secondary-VHIwge: #efefef;
                    --color-secondary-FnDBxW: #e00c0c;
                    --color-secondary-PMAiaY: #ffffff;
                    --gray-light-one: #f6f7f9;
                    --gray-light-two: #ebedef;
                    --gray-dark: #343b42;
                    --color-white: #ffffff;
                    --color-black: #000000;
                    --primary-bright-dark: #463939;
                    --primary-subtle-dark: #301d1d;
                    --primary-bright-light: #c6b9b9;
                    --primary-subtle-light: #f5efef;
                    --primary-contrast-color: #ffffff;
                    --secondary-bright-dark: #2d3953;
                    --secondary-subtle-dark: #1d2330;
                    --secondary-bright-light: #acb9d2;
                    --secondary-subtle-light: #eff1f5;
                    --secondary-contrast-color: #000000;
                    --site-background-color: var(--gray-dark);
                    --gutter-column-xs: 16px;
                    --gutter-column-sm: 16px;
                    --gutter-column-md: 16px;
                    --gutter-column-lg: 16px;
                    --gutter-column-xl: 16px;
                    --gutter-row-xs: 16px;
                    --gutter-row-sm: 16px;
                    --gutter-row-md: 16px;
                    --gutter-row-lg: 16px;
                    --gutter-row-xl: 16px;
                }

                .container {
                    margin: 0 auto;
                }

                .w-block--contain-none .container {
                    max-width: none;
                }

                .w-block--contain-block {
                    max-width: 1200px;
                }
            </style>
            <link href="https://cdn3.editmysite.com/app/website/js/../css/navigation-mobile.593f75ea0cd0339afd2f.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/96166.a59f11c08794eed75e2e.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/cart-1.1dec8a579994a914542f.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/6090.b53863a235f919eb5672.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/header-6.34ba4b2b95abd8de0be9.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/featured-categories-fullbleed-overlay.f7863162d9c530ec6017.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/26011.684ff466fa4a1f0c5942.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/footer-7.7d9df2bbcb508697998e.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/free-footer.86d148e5cb2be7f08d49.css" rel="stylesheet" type="text/css" />
        </head>
        <body>
            <body class="show-all-popups">
                <div class="app-container" data-v-90c54f5a="">
                    <div class="📚19-4-0rI2oH" data-v-90c54f5a="" style='--maker-color-neutral-0: #343b42; --maker-color-neutral-10: #5d6368; --maker-color-neutral-20: #797e83; --maker-color-neutral-80: #9da1a5; --maker-color-neutral-90: #f4f4f5; --maker-color-neutral-100: #ffffff; --maker-color-primary: #212121; --maker-color-background: #343b42; --maker-color-heading: #ffffff; --maker-color-body: #ffffff; --maker-color-elevation: #797e83; --maker-color-overlay: rgba(255, 255, 255, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px;'>
                        <div class="📚19-4-0QtxK6 📚19-4-0_EoEp theme-square w-background-dark" data-v-90c54f5a="" id="app">
                            <div class="" data-v-90c54f5a="" tabindex="0">
                                <div class="reset-z-index" data-v-b0348236="">
                                    <!-- -->
                                    <div data-v-5b51b8b9="" data-v-b0348236="">
                                        <div class="slideout" data-v-5b51b8b9="" data-v-d5f23816="" style="--slideout-max-height: 293px; display: none;">
                                            <div class="slideout__overlay" data-v-d5f23816=""></div>
                                            <div data-v-d5f23816="">
                                                <div class="w-container slideout__content col slideout--right" data-v-614c05a6="" data-v-d5f23816="">
                                                    <div class="w-cell slideout__row row" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" data-v-d5f23816="">
                                                        <div class="w-block-wrapper" data-block-purpose="nav-mobile@^1.2.1" data-v-301e84c2="" data-v-d5f23816="" id="lSiIEt" type="block">
                                                            <div data-v-301e84c2="">
                                                                <div class="nav-mobile w-block w-background-dark" data-v-1170136a="" data-v-301e84c2="" data-v-34fad261="" id="2a1c29f2-4a97-11ee-9720-3b85166b6faf" isdark="true" layout="navigation-mobile" shortid="lSiIEt" style="background-color: var(--gray-dark); --text-color: #ffffff; --text-color-10: #494f55; --text-color-20: #5d6368; --text-color-30: #71767b; --text-color-40: #868a8e; --text-color-50: #9a9da1; --text-color-60: #aeb1b4; --text-color-70: #c3c5c7; --text-color-80: #d7d8da; --text-color-90: #ebeced; --text-color-alpha-10: rgba(255, 255, 255, 0.1); text-align: center; flex-direction: column; height: 100vh;">
                                                                    <div class="container content-align--center" data-v-34fad261="">
                                                                        <div class="w-container row" data-v-34fad261="" data-v-614c05a6="">
                                                                            <div class="w-cell col col-10 col-sm-10 col-md-10 col-lg-10 cell--empty align--left" data-v-34fad261="" data-v-614c05a6="" data-v-6bcfc41e="" style="margin-top: calc(var(--gutter-row-xs) * 1); margin-bottom: calc(var(--gutter-row-xs) * 1);"></div>
                                                                            <div class="w-cell col col-2 col-sm-2 col-md-2 col-lg-2 align--right" data-v-34fad261="" data-v-614c05a6="" data-v-6bcfc41e="" style="margin-top: calc(var(--gutter-row-xs) * 1); margin-bottom: calc(var(--gutter-row-xs) * 1);">
                                                                                <div class="w-wrapper" data-v-34fad261="" data-v-6bcfc41e="" data-v-ab1ca44a="">
                                                                                    <div class="nav-icon nav-icon__close" data-v-34fad261="" data-v-70b8cb91="" data-v-ab1ca44a="" id="2a3493f6-4a97-11ee-9720-3b85166b6faf">
                                                                                        <span class="icon 📚19-4-0vCfSe" data-v-4700918e="" data-v-70b8cb91="" style="--color: var(--color-white); --icon-size: 24px; --fill: currentColor;">
                                                                                            <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                <path d="m6.71 18.71 5.29-5.3 5.29 5.3 1.42-1.42-5.3-5.29 5.3-5.29-1.42-1.42-5.29 5.3-5.29-5.3-1.42 1.42 5.3 5.29-5.3 5.29 1.42 1.42Z" fill="currentColor"></path>
                                                                                            </svg>
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div class="nav-scroll" data-v-34fad261="">
                                                                        <!-- -->
                                                                        <div class="w-wrapper" data-v-34fad261="" data-v-ab1ca44a="">
                                                                            <div data-v-34fad261="" data-v-53e2d1eb="" data-v-ab1ca44a="" id="2a3493f5-4a97-11ee-9720-3b85166b6faf">
                                                                                <nav class="w-nav nav--mobile" data-v-53e2d1eb="">
                                                                                    <ul class="nav__main ready nav--uppercase" data-v-6384e47a="" style="text-align: center; --nav-color-link: var(--color-white); --nav-color-underline: var(--color-white);">
                                                                                        <!-- The rest of the navigation bar content provided by the user is here... -->
                                                                                    </ul>
                                                                                </nav>
                                                                            </div>
                                                                        </div>
                                                                        <!-- -->
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div class="w-block-wrapper" data-block-purpose="cart@^1.3.6" data-v-301e84c2="" data-v-d5f23816="" id="WENSBt" style="display: none;" type="block">
                                                            <div class="📚19-4-0rI2oH" data-v-301e84c2="" style='--maker-color-neutral-0: #ffffff; --maker-color-neutral-10: #f1f1f1; --maker-color-neutral-20: #d3d3d3; --maker-color-neutral-80: #707070; --maker-color-neutral-90: #1b1b1b; --maker-color-neutral-100: #000000; --maker-color-primary: #212121; --maker-color-background: #ffffff; --maker-color-heading: #000000; --maker-color-body: #000000; --maker-color-elevation: #ffffff; --maker-color-overlay: rgba(0, 0, 0, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px; background: none;'>
                                                                <div class="slideout-cart-container w-block 📚19-4-0rI2oH" data-v-301e84c2="" data-v-48cacf2f="" id="2a1c29f3-4a97-11ee-9720-3b85166b6faf" layout="cart-1" shortid="WENSBt" style='--maker-color-neutral-0: #343b42; --maker-color-neutral-10: #5d6368; --maker-color-neutral-20: #797e83; --maker-color-neutral-80: #9da1a5; --maker-color-neutral-90: #f4f4f5; --maker-color-neutral-100: #ffffff; --maker-color-primary: #212121; --maker-color-background: #343b42; --maker-color-heading: #ffffff; --maker-color-body: #ffffff; --maker-color-elevation: #797e83; --maker-color-overlay: rgba(255, 255, 255, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px;'>
                                                                    <form data-v-48cacf2f="">
                                                                        <div background="[object Object]" class="blade-wrapper" content-align="" data-v-2e2967c3="" data-v-48cacf2f="" data-v-c07a14ba="" elements="[object Object]" style="--fulfillment-button-color: var(--maker-color-neutral-100);" styles="[object Object]">
                                                                            <!-- -->
                                                                            <div class="heading compact-style-heading" data-v-2e2967c3="">
                                                                                <div class="heading-content" data-v-2e2967c3="">
                                                                                    <h3 class="heading-title" data-v-2e2967c3=""> Shopping Cart </h3>
                                                                                    <div class="icon-wrapper" data-v-2e2967c3="">
                                                                                        <span class="icon heading-icon 📚19-4-0vCfSe" data-v-2e2967c3="" data-v-4700918e="" style="--color: currentColor; --icon-size: 16px; --fill: currentColor;">
                                                                                            <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                <path d="m6.71 18.71 5.29-5.3 5.29 5.3 1.42-1.42-5.3-5.29 5.3-5.29-1.42-1.42-5.29 5.3-5.29-5.3-1.42 1.42 5.3 5.29-5.3 5.29 1.42 1.42Z" fill="currentColor"></path>
                                                                                            </svg>
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                                <div class="banner" data-v-2e2967c3="">
                                                                                    <div data-v-2e2967c3="" data-v-c07a14ba="">
                                                                                        <!-- -->
                                                                                        <!-- -->
                                                                                        <!-- -->
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div class="content" data-v-2e2967c3="">
                                                                                <div class="cart-middle" data-v-2e2967c3="" data-v-c07a14ba="">
                                                                                    <div class="w-container cart-slideout-container col" data-v-2e2967c3="" data-v-614c05a6="" data-v-c07a14ba="">
                                                                                        <div class="w-cell row align--center" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" data-v-c07a14ba="">
                                                                                            <div class="text-component 📚19-4-0uGevg 📚19-4-0W7uVy w-text--rendered" data-v-54fd6eb4="" data-v-6bcfc41e="" data-v-7df72e6e="" data-v-c07a14ba="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); --inline-link-color: var(--primary-color); padding-left: 0em;'>
                                                                                                <p>You don't have any items in your cart.</p>
                                                                                            </div>
                                                                                            <!-- -->
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <!-- -->
                                                                            </div>
                                                                            <div class="footing" data-v-2e2967c3="" style="display: none;">
                                                                                <div class="cart-slideout-container__checkout js-cart-slideout-container__checkout" data-v-2e2967c3="" data-v-c07a14ba="">
                                                                                    <!-- -->
                                                                                    <button class="cart-slideout-container__checkout-button 📚19-4-0vQBWk 📚19-4-0wcHKQ 📚19-4-0S6z9M 📚19-4-0_N8aS 📚19-4-0vaDLi" data-v-2e2967c3="" data-v-c07a14ba="" disabled="disabled" style="--color-main: #e00c0c; --color-contrast: #ffffff; --color-hover: #f32222; --color-active: #f54848; --color-focus: #e00c0c4d;" type="button">
                                                                                        <!-- -->
                                                                                        <span class="📚19-4-0DK0_A 📚19-4-0O_pqx"> Checkout </span>
                                                                                        <!-- -->
                                                                                    </button>
                                                                                </div>
                                                                                <div class="font--large continue-shopping" data-v-2e2967c3="" data-v-c07a14ba="">
                                                                                    <button class="📚19-4-0_xxoX 📚19-4-0t5BZq" data-v-2e2967c3="" data-v-c07a14ba="" style="--color: #ffffff;" type="button">
                                                                                        <!-- -->
                                                                                        <span class="📚19-4-0qfj5z"> Continue Shopping </span>
                                                                                    </button>
                                                                                </div>
                                                                                <div class="cart-section__divider 📚19-4-0_q2yX" data-v-2e2967c3="" data-v-c07a14ba="" style="--divider-color: #797e83; --divider-size: 1px;"></div>
                                                                                <div class="accepted-pay accepted-pay--new-line" data-v-2e2967c3="" data-v-c07a14ba="">
                                                                                    <div class="accepted-pay__text" data-v-2e2967c3="" data-v-c07a14ba=""> Accepted here </div>
                                                                                    <div class="payment-methods" data-v-2e2967c3="" data-v-584fc356="" data-v-c07a14ba="">
                                                                                        <span class="square-pay" data-v-584fc356="">
                                                                                            <svg class="square-pay__icon" data-v-584fc356="" height="24" version="1.1" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                                                                                                <path d="M 3.469 0.034 C 2.879 0.110, 2.269 0.345, 1.740 0.699 C 1.451 0.892, 0.892 1.451, 0.699 1.740 C 0.397 2.191, 0.186 2.694, 0.069 3.240 C 0.018 3.483, 0.015 3.896, 0.015 12 C 0.015 20.104, 0.018 20.517, 0.069 20.760 C 0.248 21.594, 0.587 22.222, 1.182 22.819 C 1.767 23.405, 2.411 23.753, 3.240 23.931 C 3.483 23.982, 3.896 23.985, 12 23.985 C 20.221 23.985, 20.514 23.983, 20.775 23.928 C 21.295 23.819, 21.811 23.602, 22.260 23.301 C 22.549 23.108, 23.108 22.549, 23.301 22.260 C 23.672 21.706, 23.970 20.890, 23.970 20.431 C 23.970 20.365, 23.983 20.310, 24 20.310 C 24.020 20.310, 24.030 17.508, 24.030 11.963 C 24.029 6.562, 24.019 3.631, 24 3.660 C 23.979 3.693, 23.971 3.670, 23.970 3.576 C 23.969 3.262, 23.788 2.634, 23.577 2.214 C 23.375 1.812, 23.172 1.536, 22.818 1.182 C 22.242 0.607, 21.643 0.274, 20.835 0.081 L 20.565 0.017 12.120 0.012 C 7.333 0.009, 3.586 0.019, 3.469 0.034 M 0.015 12 C 0.015 16.595, 0.018 18.475, 0.022 16.178 C 0.027 13.880, 0.027 10.120, 0.022 7.823 C 0.018 5.525, 0.015 7.405, 0.015 12 M 5.646 4.847 C 5.308 4.938, 5.012 5.197, 4.884 5.514 L 4.815 5.685 4.815 12 L 4.815 18.315 4.884 18.484 C 4.966 18.687, 5.137 18.889, 5.333 19.016 C 5.641 19.213, 5.196 19.202, 12.077 19.193 L 18.315 19.185 18.486 19.116 C 18.688 19.034, 18.924 18.832, 19.033 18.646 C 19.211 18.342, 19.201 18.735, 19.193 11.923 L 19.185 5.685 19.113 5.505 C 19.014 5.259, 18.741 4.986, 18.495 4.887 L 18.315 4.815 12.060 4.809 C 6.704 4.804, 5.782 4.810, 5.646 4.847 M 9.409 9.044 C 9.261 9.097, 9.128 9.222, 9.057 9.375 C 9.004 9.489, 9.001 9.625, 9.001 11.970 C 9 13.692, 9.010 14.481, 9.034 14.565 C 9.077 14.721, 9.279 14.923, 9.435 14.966 C 9.603 15.013, 14.397 15.013, 14.565 14.966 C 14.635 14.947, 14.736 14.882, 14.809 14.809 C 14.882 14.736, 14.947 14.635, 14.966 14.565 C 15.013 14.397, 15.013 9.603, 14.966 9.435 C 14.923 9.279, 14.721 9.077, 14.565 9.034 C 14.481 9.010, 13.698 9.001, 11.985 9.001 C 9.974 9.002, 9.504 9.010, 9.409 9.044" fill-rule="evenodd"></path>
                                                                                            </svg>
                                                                                        </span>
                                                                                        <img alt="Apple Pay" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/applepay.svg" />
                                                                                        <img alt="Google Pay" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/googlepay.svg" />
                                                                                        <img alt="Visa" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/visa.svg" />
                                                                                        <img alt="Mastercard" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/mastercard.svg" />
                                                                                        <img alt="American Express" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/americanexpress.svg" />
                                                                                        <img alt="Discover" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/discover.svg" />
                                                                                        <img alt="JCB" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/jcb.svg" />
                                                                                        <img alt="CashApp" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/cashapp.svg" />
                                                                                        <!-- -->
                                                                                        <!-- -->
                                                                                        <!-- -->
                                                                                        <!-- -->
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </form>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="w-container main-container col" data-v-5b51b8b9="" data-v-614c05a6="">
                                            <div class="w-cell header-banner-wrapper row" data-v-31605ed0="" data-v-5b51b8b9="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" style="--transparent-header-height: 222px;">
                                                <div class="w-block-wrapper header" data-block-purpose="header" data-v-301e84c2="" data-v-31605ed0="" id="ZTImGA" type="block">
                                                    <div class="📚19-4-0rI2oH" data-v-301e84c2="" style='--maker-color-neutral-0: #000000; --maker-color-neutral-10: #363636; --maker-color-neutral-20: #575757; --maker-color-neutral-80: #848484; --maker-color-neutral-90: #f1f1f1; --maker-color-neutral-100: #ffffff; --maker-color-primary: #212121; --maker-color-background: #000000; --maker-color-heading: #ffffff; --maker-color-body: #ffffff; --maker-color-elevation: #575757; --maker-color-overlay: rgba(255, 255, 255, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px; background: none;'>
                                                        <div class="w-block-header w-block" data-v-301e84c2="" data-v-5861d7e1="" data-v-ad6516ec="" id="2a1c29f1-4a97-11ee-9720-3b85166b6faf" layout="header-6" shortid="ZTImGA" style="--text-color: #ffffff; --text-color-10: #1a1a1a; --text-color-20: #333333; --text-color-30: #4d4d4d; --text-color-40: #666666; --text-color-50: #808080; --text-color-60: #999999; --text-color-70: #b3b3b3; --text-color-80: #cccccc; --text-color-90: #e6e6e6; --text-color-alpha-10: rgba(255, 255, 255, 0.1);" subnavcolor="--color-black" textalign="">
                                                            <div data-v-ad6516ec="" style="height: 0px;"></div>
                                                            <div class="w-block-background" data-v-ad6516ec="" isdark="true" style="background-color: var(--color-black); top: 0px; --sticky-header-bg-color: #343b42;">
                                                                <div class="w-header header-6 container header-content content-align--center" data-v-5861d7e1="" style="text-align: center; min-height: auto; --icons-spacing: calc(var(--gutter-column) * 0.66);">
                                                                    <div class="w-container header__content-container col" data-v-5861d7e1="" data-v-614c05a6="">
                                                                        <div class="w-cell header__top header__condensed row" data-v-5861d7e1="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" style="margin-top: calc(var(--gutter-row-md) * 1.5); margin-bottom: calc(var(--gutter-row-md) * 0);">
                                                                            <div class="header-animate__wrap header__hamburger" data-v-5861d7e1="" data-v-695112c6="" data-v-6bcfc41e="" data-v-8cf4aed2="">
                                                                                <div class="w-wrapper display-mobile" data-v-695112c6="" data-v-8cf4aed2="" data-v-ab1ca44a="">
                                                                                    <div class="hamburger-icon nav-icon nav-icon__hamburger" data-v-70b8cb91="" data-v-8cf4aed2="" data-v-ab1ca44a="" id="2a3493f3-4a97-11ee-9720-3b85166b6faf">
                                                                                        <span class="icon 📚19-4-0vCfSe" data-v-4700918e="" data-v-70b8cb91="" style="--color: var(--color-white); --icon-size: 24px; --fill: currentColor;">
                                                                                            <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                <path clip-rule="evenodd" d="M3 6h18v2H3V6Zm18 5H3v2h18v-2Zm0 5H3v2h18v-2Z" fill="currentColor" fill-rule="evenodd"></path>
                                                                                            </svg>
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div class="header-animate__wrap header__logo" data-v-5861d7e1="" data-v-695112c6="" data-v-6bcfc41e="">
                                                                                <div class="w-wrapper" data-v-695112c6="" data-v-ab1ca44a="">
                                                                                    <a class="logo__link router-link-exact-active router-link-active" data-v-6f51d002="" data-v-ab1ca44a="" href="/booktomnyc/" id="2a3493f0-4a97-11ee-9720-3b85166b6faf" style="text-align: inherit;">
                                                                                        <span class="w-sitelogo" data-v-23d6841e="" data-v-6f51d002="" data-wg-notranslate="" style="text-align: inherit;">
                                                                                            <div class="📚19-4-0emJCV" data-v-23d6841e="" style="--width: 140px; --mobile-width: 60px;">
                                                                                                <!-- -->
                                                                                                <img alt="BookTomNYC logo" class="📚19-4-0j_xX0 📚19-4-0NojeF 📚19-4-0_7QZj" sizes="(min-width: 600px) 140px, 60px" src="https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=2400&amp;optimize=medium" srcset="https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=400&amp;optimize=medium 400w, https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=800&amp;optimize=medium 800w, https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=1200&amp;optimize=medium 1200w, https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=1600&amp;optimize=medium 1600w, https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=2000&amp;optimize=medium 2000w, https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=2400&amp;optimize=medium 2400w" style="--image-height: 140px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </span>
                                                                                    </a>
                                                                                </div>
                                                                            </div>
                                                                            <!-- -->
                                                                            <div class="header__icons header__icons" data-v-5861d7e1="" data-v-6bcfc41e="" data-v-72d6405b="">
                                                                                <div class="header-animate__wrap header__button display-desktop" data-v-695112c6="" data-v-72d6405b=""></div>
                                                                                <div class="w-wrapper icons" data-v-72d6405b="" data-v-ab1ca44a="">
                                                                                    <div class="header-animate__wrap icon header__search" data-v-695112c6="" data-v-72d6405b="" data-v-9820d1ea="" data-v-ab1ca44a="">
                                                                                        <div class="search-icon nav-icon nav-icon__search" data-v-695112c6="" data-v-70b8cb91="" data-v-9820d1ea="">
                                                                                            <button aria-label="Search" class="nav-btn search-icon__wrap" data-v-70b8cb91="">
                                                                                                <span class="icon 📚19-4-0vCfSe" data-v-4700918e="" data-v-70b8cb91="" style="--color: var(--color-white); --icon-size: 24px; --fill: currentColor;">
                                                                                                    <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                        <path d="M10.5 17.5c1.57 0 3.02-.53 4.18-1.4l4.11 4.11 1.41-1.41-4.11-4.11a7 7 0 1 0-12.6-4.18 7 7 0 0 0 7.01 6.99Zm0-12a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" fill="currentColor"></path>
                                                                                                    </svg>
                                                                                                </span>
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                    <!-- -->
                                                                                    <div data-v-72d6405b="" data-v-ab1ca44a="" style="display: contents;">
                                                                                        <div class="header-animate__wrap icon header__cart" data-v-695112c6="" data-v-72d6405b="" data-v-de3485b0="">
                                                                                            <button aria-label="Cart icon" class="nav-btn cart-icon cart-icon__wrap" data-v-695112c6="" data-v-de3485b0="">
                                                                                                <span class="icon 📚19-4-0vCfSe" data-v-4700918e="" data-v-695112c6="" data-v-de3485b0="" style="--color: var(--color-white); --icon-size: 24px; --fill: currentColor;">
                                                                                                    <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                        <path clip-rule="evenodd" d="M7 14a1 1 0 0 0-1 1 1 1 0 0 0 1 1h13v2H7a2.98 2.98 0 0 1-1.33-5.67L4 4H2V2h6v2h12l-2 10H7Zm9.36-2 1.2-6H6.44l1.2 6h8.72ZM7.5 22a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor" fill-rule="evenodd"></path>
                                                                                                    </svg>
                                                                                                </span>
                                                                                                <!-- -->
                                                                                            </button>
                                                                                        </div>
                                                                                        <!-- -->
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div class="search__wrap" data-v-5861d7e1="" data-v-6bcfc41e="" data-v-fa7658ac="">
                                                                                <div class="search-bar__wrap" data-v-fa7658ac="">
                                                                                    <div class="autocomplete-container search-bar" data-v-50a1234d="" data-v-fa7658ac="">
                                                                                        <div class="📚19-4-0rIy1g" data-v-50a1234d="">
                                                                                            <div class="📚19-4-0_FrL8 📚19-4-0_2TXJ">
                                                                                                <input aria-label="Search" class="📚19-4-0U4Dfn 📚19-4-0jZ_Vi" placeholder="Search" />
                                                                                                <span class="📚19-4-0swXoB 📚19-4-0qI9Qu">
                                                                                                    <span class="icon icon-prefix 📚19-4-0vCfSe" data-v-4700918e="" data-v-50a1234d="" style="--color: currentColor; --icon-size: 24px; --fill: var(--color-black);">
                                                                                                        <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                            <path d="M10.5 17.5c1.57 0 3.02-.53 4.18-1.4l4.11 4.11 1.41-1.41-4.11-4.11a7 7 0 1 0-12.6-4.18 7 7 0 0 0 7.01 6.99Zm0-12a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" fill="currentColor"></path>
                                                                                                        </svg>
                                                                                                    </span>
                                                                                                </span>
                                                                                                <span class="📚19-4-0swXoB 📚19-4-0Du2TA">
                                                                                                    <span class="icon 📚19-4-0vCfSe" data-v-4700918e="" data-v-50a1234d="" style="--color: currentColor; --icon-size: 16px; --fill: currentColor;">
                                                                                                        <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                            <path d="m6.71 18.71 5.29-5.3 5.29 5.3 1.42-1.42-5.3-5.29 5.3-5.29-1.42-1.42-5.29 5.3-5.29-5.3-1.42 1.42 5.3 5.29-5.3 5.29 1.42 1.42Z" fill="currentColor"></path>
                                                                                                        </svg>
                                                                                                    </span>
                                                                                                </span>
                                                                                            </div>
                                                                                            <!-- -->
                                                                                        </div>
                                                                                        <!-- -->
                                                                                        <div class="autocomplete-dropdown square__autocomplete_autocompleteDropdown--1EI-5" data-popper-placement="bottom" data-v-1932e3c2="" data-v-50a1234d="" style="display: none; position: absolute; inset: 0px auto auto 0px; margin: 0px; transform: translate(296px, 52px);" value-key="name"></div>
                                                                                    </div>
                                                                                </div>
                                                                                <div class="search-bar__icon--close" data-v-fa7658ac="">
                                                                                    <div class="nav-icon nav-icon__searchClose" data-v-70b8cb91="" data-v-fa7658ac="">
                                                                                        <span class="icon 📚19-4-0vCfSe" data-v-4700918e="" data-v-70b8cb91="" style="--color: var(--color-white); --icon-size: 24px; --fill: currentColor;">
                                                                                            <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                <path d="m6.71 18.71 5.29-5.3 5.29 5.3 1.42-1.42-5.3-5.29 5.3-5.29-1.42-1.42-5.29 5.3-5.29-5.3-1.42 1.42 5.3 5.29-5.3 5.29 1.42 1.42Z" fill="currentColor"></path>
                                                                                            </svg>
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div class="w-cell display-desktop row" data-v-5861d7e1="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" style="margin-top: calc(var(--gutter-row-sm) * 1); margin-bottom: calc(var(--gutter-row-sm) * 1);">
                                                                            <div class="header-animate__wrap header__navigation" data-v-5861d7e1="" data-v-695112c6="" data-v-6bcfc41e="">
                                                                                <div class="w-wrapper" data-v-695112c6="" data-v-ab1ca44a="">
                                                                                    <nav class="w-nav nav--desktop square__navigation-desktop_desktopNav--ZEnDx" data-v-6384e47a="" data-v-ab1ca44a="" id="2a3493f2-4a97-11ee-9720-3b85166b6faf">
                                                                                        <ul class="nav__main ready nav--uppercase" data-v-6384e47a="" style="text-align: center; --nav-color-link: var(--color-white); --nav-color-underline: var(--color-white);">
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 500; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/minor-home-repairs.html"> Minor Home Repairs </a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 600; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/computer-tech-services.html"> Computer Tech Services </a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 600; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/electrical-help.html"> Electrical help </a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 600; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/wall-mounting.html"> Wall Mounting </a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 600; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/furniture-fixes-assembly.html"> Furniture Fixes &amp; Assembly </a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 600; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/plumbing-help.html"> Plumbing help </a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 600; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/s/appointments"> Book </a>
                                                                                                <div class="nav__subnav nav__subnav--dropdown dropdown__subnav--wrapper square__navigation-desktop_subnavDropdown--3onPj" data-v-23ca0682="" data-v-6384e47a="" style="margin-top: 15.7px; background: rgb(0, 0, 0); --nav-color-link: var(--color-white); --nav-color-underline: var(--color-white);">
                                                                                                    <ul class="w-background-dark" data-v-23ca0682="">
                                                                                                        <li class="nav__item" data-v-23ca0682="">
                                                                                                            <a allow-nav="" class="" data-v-23ca0682="" href="/booktomnyc/s/appointments"> Book </a>
                                                                                                        </li>
                                                                                                    </ul>
                                                                                                </div>
                                                                                            </li>
                                                                                            <li class="text-component nav__item nav__more-link 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 500; color: rgb(255, 255, 255); padding-left: 0.01em; display: none;'>
                                                                                                <a data-v-6384e47a="" href="#">More</a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                        </ul>
                                                                                        <!-- -->
                                                                                    </nav>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <!-- -->
                                                                </div>
                                                                <!-- -->
                                                                <!-- -->
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <!-- -->
                                            </div>
                                            <!-- -->
                                            <!-- -->
                                            <div class="w-cell user-content row main-content-wrapper" data-v-5b51b8b9="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="">
                                                <div class="w-container col" data-v-5b51b8b9="" data-v-614c05a6="" data-v-6bcfc41e="">
                                                    <div class="w-cell row" data-v-5b51b8b9="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="">
                                                        <div class="w-block-wrapper" data-block-purpose="featured-categories@^1.0.0" data-v-301e84c2="" data-v-5b51b8b9="" id="mPUTGp" type="block">
                                                            <div class="📚19-4-0rI2oH" data-v-301e84c2="" style='--maker-color-neutral-0: #343b42; --maker-color-neutral-10: #5d6368; --maker-color-neutral-20: #797e83; --maker-color-neutral-80: #9da1a5; --maker-color-neutral-90: #f4f4f5; --maker-color-neutral-100: #ffffff; --maker-color-primary: #212121; --maker-color-background: #343b42; --maker-color-heading: #ffffff; --maker-color-body: #ffffff; --maker-color-elevation: #797e83; --maker-color-overlay: rgba(255, 255, 255, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px; background: none;'>
                                                                <div class="gallery-fullbleed w-block w-background-dark" colorprofile="custom-profile" data-v-1170136a="" data-v-20b0e156="" data-v-301e84c2="" data-v-fdc447e4="" elements="" isdark="true" layout="featured-categories-fullbleed-overlay" shortid="mPUTGp" style="background-color: var(--gray-dark); --text-color: #ffffff; --text-color-10: #494f55; --text-color-20: #5d6368; --text-color-30: #71767b; --text-color-40: #868a8e; --text-color-50: #9a9da1; --text-color-60: #aeb1b4; --text-color-70: #c3c5c7; --text-color-80: #d7d8da; --text-color-90: #ebeced; --text-color-alpha-10: rgba(255, 255, 255, 0.1);" textalign="">
                                                                    <div class="container container--flush-horizontal content-align--center" data-v-20b0e156="" style="text-align: center;">
                                                                        <div class="w-container col" data-v-614c05a6="" data-v-fdc447e4="">
                                                                            <div class="w-container section-details row" data-v-614c05a6="" data-v-f0e6268a="" data-v-fdc447e4="">
                                                                                <div class="w-cell section-details-text col offset-0 offset-sm-0 offset-md-0 offset-lg-0 offset-xl-0" data-v-614c05a6="" data-v-6bcfc41e="" data-v-f0e6268a="">
                                                                                    <div class="w-cell row row--inset" data-v-6bcfc41e="" data-v-6bda7270="" data-v-f0e6268a="">
                                                                                        <div class="w-wrapper" data-v-6bcfc41e="" data-v-ab1ca44a="" data-v-f0e6268a="">
                                                                                            <div class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l w-text--rendered" data-v-54fd6eb4="" data-v-7df72e6e="" data-v-ab1ca44a="" data-v-f0e6268a="" style='line-height: 1.1; letter-spacing: -0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 300; color: rgb(255, 255, 255); text-transform: uppercase; --inline-link-color: var(--color-white);'>
                                                                                                <h3>Service Request Category</h3>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <!-- -->
                                                                                </div>
                                                                                <!-- -->
                                                                            </div>
                                                                            <div class="w-cell featured-categories-content row" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" data-v-fdc447e4="">
                                                                                <div class="gallery-fullbleed-grid-row" data-v-6bcfc41e="" data-v-fdc447e4="">
                                                                                    <div class="w-grid visible align--centered" data-v-41f3fba4="" data-v-6bcfc41e="" data-v-fdc447e4="" style="--grid-columns-xs: 1; --grid-columns-sm: 3; --grid-columns-md: 3; --grid-columns-lg: 3; --grid-column-gap-xs: calc(var(--gutter-column) * 0.125); --grid-column-gap-sm: calc(var(--gutter-column) * 0.125); --grid-column-gap-md: calc(var(--gutter-column) * 0.125); --grid-column-gap-lg: calc(var(--gutter-column) * 0.125); --grid-column-gap-xl: calc(var(--gutter-column) * 0.125); --grid-row-gap-xs: calc(var(--gutter-column) * 0.125); --grid-row-gap-sm: calc(var(--gutter-column) * 0.125); --grid-row-gap-md: calc(var(--gutter-column) * 0.125); --grid-row-gap-lg: calc(var(--gutter-column) * 0.125); --grid-row-gap-xl: calc(var(--gutter-column) * 0.125);">
                                                                                        <div class="grid__item" data-v-41f3fba4="">
                                                                                            <div class="category-item category-item__overlay" data-v-41f3fba4="" data-v-fdc447e4="">
                                                                                                <div class="w-wrapper" data-v-41f3fba4="" data-v-608c8c16="" data-v-ab1ca44a="" data-v-fdc447e4="">
                                                                                                    <div class="w-wrapper" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                        <div class="featured-category__image" data-v-0fe68b68="" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                            <div class="figure__aspect-ratio figure__aspect-ratio--4_3 figure__hover-effect--fade" data-v-0fe68b68="">
                                                                                                                <div class="figure__image has-cursor" data-v-0fe68b68="">
                                                                                                                    <div class="📚19-4-0emJCV" data-v-0fe68b68="">
                                                                                                                        <!-- -->
                                                                                                                        <img alt="Minor Home Repairs" class="📚19-4-0j_xX0" sizes="(max-width: 599px) 320px,(max-width: 839px) 640px,(max-width: 1199px) 1280px,(max-width: 1599px) 1280px,1280px" src="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c10_i5_w1024.jpeg?width=2400&amp;optimize=medium" srcset="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c10_i5_w1024.jpeg?width=40&amp;dpr=1 40w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c10_i5_w1024.jpeg?width=80&amp;dpr=1 80w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c10_i5_w1024.jpeg?width=160&amp;dpr=1 160w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c10_i5_w1024.jpeg?width=320&amp;dpr=1 320w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c10_i5_w1024.jpeg?width=640&amp;dpr=1 640w" style="--image-height: 479px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                                        <!-- -->
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div class="category-image__overlay-fill" data-v-0fe68b68="" style="display: none;"></div>
                                                                                                                <div class="category-image__overlay-container overlay--position-center" data-v-0fe68b68="" data-v-1d7e0cdc="" should-improve-readability="true">
                                                                                                                    <div class="overlay-title" data-v-1d7e0cdc="">
                                                                                                                        <div class="w-wrapper" data-v-1d7e0cdc="" data-v-ab1ca44a="">
                                                                                                                            <h3 class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l" data-v-1d7e0cdc="" data-v-54fd6eb4="" data-v-ab1ca44a="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); padding-left: 0em;'>
                                                                                                                                <a href="/booktomnyc/minor-home-repairs.html">Minor Home Repairs</a>
                                                                                                                            </h3>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                                <div class="hover__background figure__hover hover__background--fade" data-v-0fe68b68="" data-v-4af2756b="">
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </div>
                                                                                        <div class="grid__item" data-v-41f3fba4="">
                                                                                            <div class="category-item category-item__overlay" data-v-41f3fba4="" data-v-fdc447e4="">
                                                                                                <div class="w-wrapper" data-v-41f3fba4="" data-v-608c8c16="" data-v-ab1ca44a="" data-v-fdc447e4="">
                                                                                                    <div class="w-wrapper" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                        <div class="featured-category__image" data-v-0fe68b68="" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                            <div class="figure__aspect-ratio figure__aspect-ratio--4_3 figure__hover-effect--fade" data-v-0fe68b68="">
                                                                                                                <div class="figure__image has-cursor" data-v-0fe68b68="">
                                                                                                                    <div class="📚19-4-0emJCV" data-v-0fe68b68="">
                                                                                                                        <!-- -->
                                                                                                                        <img alt="Wall Mounting" class="📚19-4-0j_xX0" sizes="(max-width: 599px) 320px,(max-width: 839px) 640px,(max-width: 1199px) 1280px,(max-width: 1599px) 1280px,1280px" src="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c13_i3_w1024.jpeg?width=2400&amp;optimize=medium" srcset="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c13_i3_w1024.jpeg?width=40&amp;dpr=1 40w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c13_i3_w1024.jpeg?width=80&amp;dpr=1 80w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c13_i3_w1024.jpeg?width=160&amp;dpr=1 160w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c13_i3_w1024.jpeg?width=320&amp;dpr=1 320w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c13_i3_w1024.jpeg?width=640&amp;dpr=1 640w" style="--image-height: 479px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                                        <!-- -->
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div class="category-image__overlay-fill" data-v-0fe68b68="" style="display: none;"></div>
                                                                                                                <div class="category-image__overlay-container overlay--position-center" data-v-0fe68b68="" data-v-1d7e0cdc="" should-improve-readability="true">
                                                                                                                    <div class="overlay-title" data-v-1d7e0cdc="">
                                                                                                                        <div class="w-wrapper" data-v-1d7e0cdc="" data-v-ab1ca44a="">
                                                                                                                            <h3 class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l" data-v-1d7e0cdc="" data-v-54fd6eb4="" data-v-ab1ca44a="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); padding-left: 0em;'>
                                                                                                                                <a href="/booktomnyc/wall-mounting.html">Wall Mounting</a>
                                                                                                                            </h3>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                                <div class="hover__background figure__hover hover__background--fade" data-v-0fe68b68="" data-v-4af2756b="">
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </div>
                                                                                        <div class="grid__item" data-v-41f3fba4="">
                                                                                            <div class="category-item category-item__overlay" data-v-41f3fba4="" data-v-fdc447e4="">
                                                                                                <div class="w-wrapper" data-v-41f3fba4="" data-v-608c8c16="" data-v-ab1ca44a="" data-v-fdc447e4="">
                                                                                                    <div class="w-wrapper" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                        <div class="featured-category__image" data-v-0fe68b68="" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                            <div class="figure__aspect-ratio figure__aspect-ratio--4_3 figure__hover-effect--fade" data-v-0fe68b68="">
                                                                                                                <div class="figure__image has-cursor" data-v-0fe68b68="">
                                                                                                                    <div class="📚19-4-0emJCV" data-v-0fe68b68="">
                                                                                                                        <!-- -->
                                                                                                                        <img alt="Computer Tech Services" class="📚19-4-0j_xX0" sizes="(max-width: 599px) 320px,(max-width: 839px) 640px,(max-width: 1199px) 1280px,(max-width: 1599px) 1280px,1280px" src="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c14_i1_w1024.jpeg?width=2400&amp;optimize=medium" srcset="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c14_i1_w1024.jpeg?width=40&amp;dpr=1 40w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c14_i1_w1024.jpeg?width=80&amp;dpr=1 80w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c14_i1_w1024.jpeg?width=160&amp;dpr=1 160w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c14_i1_w1024.jpeg?width=320&amp;dpr=1 320w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c14_i1_w1024.jpeg?width=640&amp;dpr=1 640w" style="--image-height: 479px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                                        <!-- -->
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div class="category-image__overlay-fill" data-v-0fe68b68="" style="display: none;"></div>
                                                                                                                <div class="category-image__overlay-container overlay--position-center" data-v-0fe68b68="" data-v-1d7e0cdc="" should-improve-readability="true">
                                                                                                                    <div class="overlay-title" data-v-1d7e0cdc="">
                                                                                                                        <div class="w-wrapper" data-v-1d7e0cdc="" data-v-ab1ca44a="">
                                                                                                                            <h3 class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l" data-v-1d7e0cdc="" data-v-54fd6eb4="" data-v-ab1ca44a="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); padding-left: 0em;'>
                                                                                                                                <a href="/booktomnyc/computer-tech-services.html">Computer Tech Services</a>
                                                                                                                            </h3>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                                <div class="hover__background figure__hover hover__background--fade" data-v-0fe68b68="" data-v-4af2756b="">
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <div class="gallery-fullbleed-grid-row" data-v-6bcfc41e="" data-v-fdc447e4="">
                                                                                    <div class="w-grid visible align--centered" data-v-41f3fba4="" data-v-6bcfc41e="" data-v-fdc447e4="" style="--grid-columns-xs: 1; --grid-columns-sm: 3; --grid-columns-md: 3; --grid-columns-lg: 3; --grid-column-gap-xs: calc(var(--gutter-column) * 0.125); --grid-column-gap-sm: calc(var(--gutter-column) * 0.125); --grid-column-gap-md: calc(var(--gutter-column) * 0.125); --grid-column-gap-lg: calc(var(--gutter-column) * 0.125); --grid-column-gap-xl: calc(var(--gutter-column) * 0.125); --grid-row-gap-xs: calc(var(--gutter-column) * 0.125); --grid-row-gap-sm: calc(var(--gutter-column) * 0.125); --grid-row-gap-md: calc(var(--gutter-column) * 0.125); --grid-row-gap-lg: calc(var(--gutter-column) * 0.125); --grid-row-gap-xl: calc(var(--gutter-column) * 0.125);">
                                                                                        <div class="grid__item" data-v-41f3fba4="">
                                                                                            <div class="category-item category-item__overlay" data-v-41f3fba4="" data-v-fdc447e4="">
                                                                                                <div class="w-wrapper" data-v-41f3fba4="" data-v-608c8c16="" data-v-ab1ca44a="" data-v-fdc447e4="">
                                                                                                    <div class="w-wrapper" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                        <div class="featured-category__image" data-v-0fe68b68="" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                            <div class="figure__aspect-ratio figure__aspect-ratio--4_3 figure__hover-effect--fade" data-v-0fe68b68="">
                                                                                                                <div class="figure__image has-cursor" data-v-0fe68b68="">
                                                                                                                    <div class="📚19-4-0emJCV" data-v-0fe68b68="">
                                                                                                                        <!-- -->
                                                                                                                        <img alt="Electrical help" class="📚19-4-0j_xX0" sizes="(max-width: 599px) 320px,(max-width: 839px) 640px,(max-width: 1199px) 1280px,(max-width: 1599px) 1280px,1280px" src="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c15_i1_w1024.jpeg?width=2400&amp;optimize=medium" srcset="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c15_i1_w1024.jpeg?width=40&amp;dpr=1 40w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c15_i1_w1024.jpeg?width=80&amp;dpr=1 80w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c15_i1_w1024.jpeg?width=160&amp;dpr=1 160w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c15_i1_w1024.jpeg?width=320&amp;dpr=1 320w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c15_i1_w1024.jpeg?width=640&amp;dpr=1 640w" style="--image-height: 479px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                                        <!-- -->
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div class="category-image__overlay-fill" data-v-0fe68b68="" style="display: block;"></div>
                                                                                                                <div class="category-image__overlay-container overlay--position-center" data-v-0fe68b68="" data-v-1d7e0cdc="" should-improve-readability="true">
                                                                                                                    <div class="overlay-title" data-v-1d7e0cdc="">
                                                                                                                        <div class="w-wrapper" data-v-1d7e0cdc="" data-v-ab1ca44a="">
                                                                                                                            <h3 class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l" data-v-1d7e0cdc="" data-v-54fd6eb4="" data-v-ab1ca44a="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); padding-left: 0em;'>
                                                                                                                                <a href="/booktomnyc/electrical-help.html">Electrical help</a>
                                                                                                                            </h3>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                                <div class="hover__background figure__hover hover__background--fade" data-v-0fe68b68="" data-v-4af2756b="">
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </div>
                                                                                        <div class="grid__item" data-v-41f3fba4="">
                                                                                            <div class="category-item category-item__overlay" data-v-41f3fba4="" data-v-fdc447e4="">
                                                                                                <div class="w-wrapper" data-v-41f3fba4="" data-v-608c8c16="" data-v-ab1ca44a="" data-v-fdc447e4="">
                                                                                                    <div class="w-wrapper" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                        <div class="featured-category__image" data-v-0fe68b68="" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                            <div class="figure__aspect-ratio figure__aspect-ratio--4_3 figure__hover-effect--fade" data-v-0fe68b68="">
                                                                                                                <div class="figure__image has-cursor" data-v-0fe68b68="">
                                                                                                                    <div class="📚19-4-0emJCV" data-v-0fe68b68="">
                                                                                                                        <!-- -->
                                                                                                                        <img alt="Furniture Fixes &amp; Assembly" class="📚19-4-0j_xX0" sizes="(max-width: 599px) 320px,(max-width: 839px) 640px,(max-width: 1199px) 1280px,(max-width: 1599px) 1280px,1280px" src="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c12_i2_w1024.jpeg?width=2400&amp;optimize=medium" srcset="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c12_i2_w1024.jpeg?width=40&amp;dpr=1 40w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c12_i2_w1024.jpeg?width=80&amp;dpr=1 80w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c12_i2_w1024.jpeg?width=160&amp;dpr=1 160w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c12_i2_w1024.jpeg?width=320&amp;dpr=1 320w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c12_i2_w1024.jpeg?width=640&amp;dpr=1 640w" style="--image-height: 479px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                                        <!-- -->
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div class="category-image__overlay-fill" data-v-0fe68b68="" style="display: none;"></div>
                                                                                                                <div class="category-image__overlay-container overlay--position-center" data-v-0fe68b68="" data-v-1d7e0cdc="" should-improve-readability="true">
                                                                                                                    <div class="overlay-title" data-v-1d7e0cdc="">
                                                                                                                        <div class="w-wrapper" data-v-1d7e0cdc="" data-v-ab1ca44a="">
                                                                                                                            <h3 class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l" data-v-1d7e0cdc="" data-v-54fd6eb4="" data-v-ab1ca44a="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); padding-left: 0em;'>
                                                                                                                                <a href="/booktomnyc/furniture-fixes-assembly.html">Furniture Fixes +</a>
                                                                                                                            </h3>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                                <div class="hover__background figure__hover hover__background--fade" data-v-0fe68b68="" data-v-4af2756b="">
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </div>
                                                                                        <div class="grid__item" data-v-41f3fba4="">
                                                                                            <div class="category-item category-item__overlay" data-v-41f3fba4="" data-v-fdc447e4="">
                                                                                                <div class="w-wrapper" data-v-41f3fba4="" data-v-608c8c16="" data-v-ab1ca44a="" data-v-fdc447e4="">
                                                                                                    <div class="w-wrapper" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                        <div class="featured-category__image" data-v-0fe68b68="" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                            <div class="figure__aspect-ratio figure__aspect-ratio--4_3 figure__hover-effect--fade" data-v-0fe68b68="">
                                                                                                                <div class="figure__image has-cursor" data-v-0fe68b68="">
                                                                                                                    <div class="📚19-4-0emJCV" data-v-0fe68b68="">
                                                                                                                        <!-- -->
                                                                                                                        <img alt="Plumbing help" class="📚19-4-0j_xX0" sizes="(max-width: 599px) 320px,(max-width: 839px) 640px,(max-width: 1199px) 1280px,(max-width: 1599px) 1280px,1280px" src="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c11_i2_w1024.jpeg?width=2400&amp;optimize=medium" srcset="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c11_i2_w1024.jpeg?width=40&amp;dpr=1 40w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c11_i2_w1024.jpeg?width=80&amp;dpr=1 80w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c11_i2_w1024.jpeg?width=160&amp;dpr=1 160w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c11_i2_w1024.jpeg?width=320&amp;dpr=1 320w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c11_i2_w1024.jpeg?width=640&amp;dpr=1 640w" style="--image-height: 479px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                                        <!-- -->
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div class="category-image__overlay-fill" data-v-0fe68b68="" style="display: none;"></div>
                                                                                                                <div class="category-image__overlay-container overlay--position-center" data-v-0fe68b68="" data-v-1d7e0cdc="" should-improve-readability="true">
                                                                                                                    <div class="overlay-title" data-v-1d7e0cdc="">
                                                                                                                        <div class="w-wrapper" data-v-1d7e0cdc="" data-v-ab1ca44a="">
                                                                                                                            <h3 class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l" data-v-1d7e0cdc="" data-v-54fd6eb4="" data-v-ab1ca44a="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); padding-left: 0em;'>
                                                                                                                                <a href="/booktomnyc/plumbing-help.html">Plumbing help</a>
                                                                                                                            </h3>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                                <div class="hover__background figure__hover hover__background--fade" data-v-0fe68b68="" data-v-4af2756b="">
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <!-- -->
                                            <div class="w-cell row" data-v-5b51b8b9="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="">
                                                <div class="w-block-wrapper" data-block-purpose="footer" data-v-301e84c2="" data-v-5b51b8b9="" id="rSiecF" type="block">
                                                    <div class="📚19-4-0rI2oH" data-v-301e84c2="" style='--maker-color-neutral-0: #212121; --maker-color-neutral-10: #4c4c4c; --maker-color-neutral-20: #6b6b6b; --maker-color-neutral-80: #929292; --maker-color-neutral-90: #f2f2f2; --maker-color-neutral-100: #ffffff; --maker-color-primary: #212121; --maker-color-background: #212121; --maker-color-heading: #ffffff; --maker-color-body: #ffffff; --maker-color-elevation: #6b6b6b; --maker-color-overlay: rgba(255, 255, 255, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px; background: none;'>
                                                        <div class="w-block w-background-dark" colorprofile="primary-bold" data-v-1170136a="" data-v-20b0e156="" data-v-301e84c2="" data-v-f2727a24="" isdark="true" layout="footer-7" shortid="rSiecF" style="background-color: var(--primary-color); --text-color: #ffffff; --text-color-10: #383838; --text-color-20: #4e4e4e; --text-color-30: #646464; --text-color-40: #7a7a7a; --text-color-50: #909090; --text-color-60: #a7a7a7; --text-color-70: #bdbdbd; --text-color-80: #d3d3d3; --text-color-90: #e9e9e9; --text-color-alpha-10: rgba(255, 255, 255, 0.1);" textalign="">
                                                            <div class="container content-align--center" data-v-20b0e156="" style="text-align: left;">
                                                                <div class="w-container col" data-v-614c05a6="" data-v-f2727a24="">
                                                                    <div class="w-cell row" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" data-v-f2727a24="">
                                                                        <div class="w-container align-flex-end row" data-v-614c05a6="" data-v-6bcfc41e="" data-v-f2727a24="">
                                                                            <div class="w-cell col col-12 col-sm-6 align--center-xs align--left-sm align--left-md align--left-lg align--left-xl" data-v-614c05a6="" data-v-6bcfc41e="" data-v-f2727a24="" style="margin-bottom: calc(var(--gutter-row-sm) * 0);">
                                                                                <div class="w-container col" data-v-614c05a6="" data-v-6bcfc41e="" data-v-f2727a24="">
                                                                                    <div class="w-cell row" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" data-v-f2727a24="">
                                                                                        <div class="w-wrapper" data-v-6bcfc41e="" data-v-ab1ca44a="" data-v-f2727a24="">
                                                                                            <a button="[object Object]" class="logo__link router-link-exact-active router-link-active" data-v-6f51d002="" data-v-ab1ca44a="" data-v-f2727a24="" href="/booktomnyc/" id="2a810640-4a97-11ee-9720-3b85166b6faf" name="Untitled_Project__12_-...iew.png" original="/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png" style="text-align: inherit;">
                                                                                                <span class="w-sitelogo" data-v-23d6841e="" data-v-6f51d002="" data-wg-notranslate="" style="text-align: inherit;">
                                                                                                    <div class="📚19-4-0emJCV" data-v-23d6841e="" style="--width: 315.7291666666667px; --mobile-width: 150.34722222222223px;">
                                                                                                        <!-- -->
                                                                                                        <img alt="BookTomNYC logo" class="📚19-4-0j_xX0 📚19-4-0NojeF" sizes="(min-width: 600px) 315.7291666666667px, 150.34722222222223px" src="https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=2400&amp;optimize=medium" srcset="https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=400&amp;optimize=medium 400w, https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=800&amp;optimize=medium 800w, https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=1200&amp;optimize=medium 1200w, https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=1600&amp;optimize=medium 1600w, https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=2000&amp;optimize=medium 2000w, https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=2400&amp;optimize=medium 2400w" style="--image-height: 105px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                        <!-- -->
                                                                                                    </div>
                                                                                                </span>
                                                                                            </a>
                                                                                        </div>
                                                                                    </div>
                                                                                    <!-- -->
                                                                                </div>
                                                                            </div>
                                                                            <!-- -->
                                                                        </div>
                                                                    </div>
                                                                    <!-- -->
                                                                    <!-- -->
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="w-cell row" data-v-5b51b8b9="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="">
                                                <div class="w-block-wrapper" data-block-purpose="free-footer@^1.0.0" data-v-301e84c2="" data-v-5b51b8b9="" id="BFyYkq" type="block">
                                                    <div data-v-301e84c2="">
                                                        <div class="w-block w-background-dark" data-v-1170136a="" data-v-301e84c2="" data-v-c2ac550a="" id="2a1c29f4-4a97-11ee-9720-3b85166b6faf" isdark="true" layout="free-footer-1" shortid="BFyYkq" style="background-color: rgb(50, 59, 67); --text-color: #ffffff; --text-color-10: #474f56; --text-color-20: #5b6369; --text-color-30: #70767c; --text-color-40: #848a8f; --text-color-50: #999da1; --text-color-60: #adb1b4; --text-color-70: #c2c5c7; --text-color-80: #d6d8da; --text-color-90: #ebeced; --text-color-alpha-10: rgba(255, 255, 255, 0.1);"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <svg data-v-b0348236="" style="display: none;" xmlns="http://www.w3.org/2000/svg">
                                        <symbol fill="none" id="alert-triangle-icon" viewbox="0 0 16 16">
                                            <path clip-rule="evenodd" d="M.41 13.759 7.561.794a.5.5 0 0 1 .876 0l7.153 12.965a.5.5 0 0 1-.438.741H.847a.5.5 0 0 1-.438-.741zM8 9.002a1 1 0 0 1-1-1v-2a1 1 0 0 1 2 0v2a1 1 0 0 1-1 1zm0 1A1 1 0 1 0 8 12a1 1 0 0 0 0-2z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="email-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm3.5-3h9L8.707 8.793a1 1 0 0 1-1.414 0L3.5 5zM3 6l3.586 3.586a2 2 0 0 0 2.828 0L13 6v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="embed-code-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M0 0h22v12H0z" fill="var(--background-fill)" transform="translate(21 26)"></path>
                                            <path d="m36 38 7-6-7-6M28 26l-7 6 7 6" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                                        </symbol>
                                        <symbol fill="none" id="embed-pdf-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M29.677 32.716s-3.829 10.074-6.974 9.234c-3.145-.84 5.06-5.516 8.752-6.116 3.692-.6 10.939-3.358 10.528 0-.547 3.358-5.743-.6-8.75-4.557-3.009-3.958-4.24-9.834-1.778-9.235 2.46.6-.547 8.155-1.778 10.674z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"></path>
                                        </symbol>
                                        <symbol id="facebook-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8.567 4.437V8.085H9.77l.159-1.5h-1.36l.001-.75c0-.392.037-.602.6-.602h.75v-1.5H8.718c-1.444 0-1.952.728-1.952 1.952v.9h-.9v1.5h.9v4.352h1.801z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="google-plus-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8c0-4.418 3.528-8 7.88-8s7.88 3.582 7.88 8-3.528 8-7.88 8S0 12.418 0 8zm6.438-.229v.869h1.42c-.057.373-.43 1.093-1.42 1.093-.855 0-1.552-.717-1.552-1.6 0-.883.697-1.6 1.552-1.6.487 0 .812.21.998.392l.68-.663A2.385 2.385 0 0 0 6.438 5.6c-1.384 0-2.504 1.133-2.504 2.533s1.12 2.534 2.504 2.534c1.445 0 2.404-1.028 2.404-2.476 0-.166-.018-.293-.04-.42H6.438zm5.365 0h-.715v-.723h-.715v.723h-.716v.724h.716v.724h.715v-.724h.715v-.724z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="instagram-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <g fill-rule="evenodd" style="fill:var(--icon-fill)">
                                                <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-4.267c-1.158 0-1.304.005-1.759.026a3.12 3.12 0 0 0-1.035.198 2.09 2.09 0 0 0-.756.492 2.095 2.095 0 0 0-.493.756c-.106.271-.178.582-.198 1.036-.02.455-.026.6-.026 1.759 0 1.159.005 1.304.026 1.759.021.454.093.764.198 1.035.11.281.255.52.492.756.237.238.476.384.756.493.271.105.582.177 1.036.198.455.02.6.026 1.759.026 1.159 0 1.304-.005 1.759-.026.454-.02.764-.093 1.036-.198.28-.11.518-.255.755-.493.238-.237.383-.475.493-.755.105-.272.177-.582.198-1.036.02-.455.026-.6.026-1.759 0-1.159-.006-1.304-.026-1.76-.021-.453-.093-.764-.198-1.035a2.094 2.094 0 0 0-.493-.756 2.085 2.085 0 0 0-.755-.492c-.272-.105-.583-.177-1.037-.198-.455-.02-.6-.026-1.759-.026H8z"></path>
                                                <path d="M7.618 4.502H8c1.14 0 1.275.004 1.725.025.416.019.641.088.792.147.199.077.34.17.49.319.15.15.242.291.32.49.058.15.127.376.146.792.02.45.025.585.025 1.724s-.004 1.274-.025 1.724c-.019.416-.088.641-.147.792-.077.199-.17.34-.319.49a1.32 1.32 0 0 1-.49.319c-.15.059-.376.128-.792.147-.45.02-.585.025-1.725.025-1.139 0-1.274-.005-1.724-.025-.416-.02-.641-.089-.792-.147-.2-.078-.341-.17-.49-.32a1.322 1.322 0 0 1-.32-.49c-.058-.15-.128-.376-.147-.792-.02-.45-.024-.585-.024-1.724 0-1.14.004-1.274.024-1.724.02-.416.089-.641.147-.792.077-.199.17-.341.32-.49.149-.15.29-.242.49-.32.15-.058.376-.128.792-.147.394-.018.546-.023 1.342-.024v.001zm2.66.709a.512.512 0 1 0 0 1.024.512.512 0 0 0 0-1.024zM8 5.809a2.191 2.191 0 1 0 0 4.382A2.191 2.191 0 0 0 8 5.81z"></path>
                                                <path d="M8 6.578a1.422 1.422 0 1 1 0 2.844 1.422 1.422 0 0 1 0-2.844z"></path>
                                            </g>
                                        </symbol>
                                        <symbol fill="none" id="instagram-item-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M0 0h24v24H0z" fill="var(--background-fill)" transform="translate(20 20)"></path>
                                            <rect height="22" rx="5" stroke="var(--icon-fill)" stroke-width="2" width="22" x="21" y="21"></rect>
                                            <circle cx="32" cy="32" r="5" stroke="var(--icon-fill)" stroke-width="2"></circle>
                                            <circle cx="39" cy="26" fill="var(--icon-fill)" r="1"></circle>
                                        </symbol>
                                        <svg fill="none" height="24" id="tiktok-icon" width="24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 23c6.075 0 11-4.925 11-11S18.075 1 12 1 1 5.925 1 12s4.925 11 11 11z" fill="#fff" style="fill:var(--background-fill)"></path>
                                            <path clip-rule="evenodd" d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12zm1.595-18.996c-.43 0-.86.001-1.292.008a552.03 552.03 0 0 0-.01 4.496 981.783 981.783 0 0 1-.002 3.392c.001.76.002 1.518-.04 2.279-.005.21-.11.396-.211.577l-.024.043c-.335.553-.951.931-1.594.938-.97.087-1.878-.717-2.014-1.675a11.238 11.238 0 0 0-.005-.141c-.01-.27-.019-.545.083-.797.144-.418.42-.777.785-1.02.499-.352 1.166-.404 1.737-.217 0-.37.007-.738.013-1.107.008-.495.016-.99.01-1.484-1.25-.238-2.585.163-3.538 1.004a4.392 4.392 0 0 0-1.487 2.894c-.01.29-.008.58.007.868.12 1.365.937 2.637 2.1 3.332.701.42 1.524.647 2.347.599 1.342-.023 2.648-.752 3.401-1.87a4.48 4.48 0 0 0 .778-2.3 301.8 301.8 0 0 0 .01-3.365l.001-1.74c.3.199.605.393.933.543.753.363 1.587.538 2.417.565V8.477c-.886-.1-1.796-.396-2.44-1.043-.645-.632-.961-1.541-1.007-2.434-.319.003-.638.003-.958.004z" fill="#000" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </svg>
                                        <symbol id="linkedin-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm5.654-1.374H3.84v5.447h1.813V6.626zm.119-1.685C5.76 4.407 5.379 4 4.759 4s-1.026.407-1.026.94c0 .524.394.942 1.002.942h.012c.632 0 1.026-.418 1.026-.941zm6.419 4.009c0-1.673-.895-2.452-2.088-2.452-.962 0-1.393.529-1.634.9v-.772H6.657c.024.511 0 5.447 0 5.447H8.47V9.031c0-.163.012-.325.06-.442.131-.325.43-.662.93-.662.656 0 .919.5.919 1.232v2.914h1.813V8.95z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="twitter-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.76-1.497.017.276-.28-.034c-1.018-.13-1.908-.57-2.663-1.31l-.37-.367-.095.27c-.201.605-.072 1.244.347 1.673.224.237.174.271-.212.13-.135-.045-.252-.08-.263-.062-.04.04.095.553.201.757.146.282.442.559.767.723l.274.13-.325.005c-.313 0-.324.006-.29.125.111.367.553.757 1.046.926l.347.119-.302.18a3.15 3.15 0 0 1-1.5.419c-.252.005-.459.028-.459.045 0 .056.683.373 1.08.497 1.192.367 2.608.21 3.67-.418.756-.446 1.512-1.333 1.864-2.192.19-.458.38-1.294.38-1.695 0-.26.018-.294.33-.604.186-.181.36-.379.393-.435.056-.108.05-.108-.235-.012-.476.17-.543.147-.308-.107.173-.18.38-.508.38-.604 0-.017-.084.01-.179.062-.1.056-.324.141-.492.192l-.302.096-.274-.187a2.278 2.278 0 0 0-.476-.248 1.909 1.909 0 0 0-.98.022c-.699.255-1.141.91-1.09 1.628z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="vimeo-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm12.529-1.546c.057-1.25-.409-1.89-1.395-1.919-1.33-.043-2.232.708-2.704 2.253a1.8 1.8 0 0 1 .71-.158c.49 0 .705.275.647.823-.029.331-.244.814-.646 1.449-.403.635-.705.952-.905.952-.259 0-.496-.489-.712-1.467-.072-.287-.201-1.02-.388-2.2-.172-1.093-.632-1.604-1.38-1.532-.315.03-.79.316-1.422.862-.46.417-.927.833-1.4 1.25l.45.581c.431-.3.682-.452.754-.452.33 0 .638.517.925 1.55l.775 2.84c.387 1.034.86 1.55 1.42 1.55.903 0 2.008-.848 3.313-2.544 1.262-1.624 1.915-2.904 1.958-3.838z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="video-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M28 40V25l11 7.5L28 40z" fill="var(--icon-fill)" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                                        </symbol>
                                        <symbol id="youtube-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8c0-4.418 3.528-8 7.88-8s7.88 3.582 7.88 8-3.528 8-7.88 8S0 12.418 0 8zm11.982-1.61s-.082-.601-.334-.866c-.32-.347-.677-.349-.84-.369-1.175-.088-2.937-.088-2.937-.088h-.004s-1.762 0-2.936.088c-.165.02-.522.022-.842.37-.251.264-.333.865-.333.865s-.084.705-.084 1.411v.662c0 .705.084 1.411.084 1.411s.082.6.333.865c.32.348.74.337.926.373.672.067 2.854.088 2.854.088s1.764-.003 2.938-.091c.164-.02.522-.022.841-.37.252-.264.334-.865.334-.865s.084-.706.084-1.411V7.8c0-.706-.084-1.411-.084-1.411zm-4.98 2.874v-2.45l2.268 1.23-2.268 1.22z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="pinterest-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm-2.63-1.07h.47c.3-.49.74-1.28.9-1.9l.46-1.73c.23.45.92.83 1.66.83 2.18 0 3.76-2 3.76-4.5 0-2.4-1.95-4.2-4.47-4.2-3.13 0-4.79 2.1-4.79 4.4 0 1.06.57 2.38 1.47 2.8.14.07.21.04.24-.1l.2-.81a.22.22 0 0 0-.04-.21 2.82 2.82 0 0 1-.54-1.66c0-1.6 1.2-3.14 3.27-3.14 1.78 0 3.03 1.2 3.03 2.95 0 1.96-1 3.32-2.28 3.32-.71 0-1.25-.6-1.08-1.31.21-.87.6-1.8.6-2.42 0-.56-.3-1.02-.91-1.02-.73 0-1.31.75-1.31 1.76 0 .64.21 1.08.21 1.08l-.85 3.6a8.15 8.15 0 0 0 0 2.26z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="snapchat-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8c0-4.42 3.53-8 7.88-8a7.94 7.94 0 0 1 7.88 8c0 4.42-3.53 8-7.88 8A7.94 7.94 0 0 1 0 8zm7.95-4h-.17c-.18 0-.55.03-.96.2A2.14 2.14 0 0 0 5.7 5.37c-.19.43-.14 1.15-.1 1.73v.19a.32.32 0 0 1-.13.02.9.9 0 0 1-.38-.1.33.33 0 0 0-.14-.03.5.5 0 0 0-.25.07.35.35 0 0 0-.18.23c0 .06 0 .18.12.3a.9.9 0 0 0 .31.18l.13.05c.15.05.39.12.45.27.03.07.02.17-.04.29a2.82 2.82 0 0 1-.94 1.13c-.22.15-.46.24-.71.28a.2.2 0 0 0-.17.21l.02.09c.04.1.14.17.29.25.18.08.46.16.82.21l.05.19.05.2c.02.07.08.16.22.16.06 0 .12 0 .2-.02a2.15 2.15 0 0 1 .75-.03c.2.04.38.16.59.31a1.89 1.89 0 0 0 1.26.46c.52 0 .86-.24 1.16-.46.2-.15.38-.27.59-.3a1.9 1.9 0 0 1 .75.01l.2.03c.11 0 .2-.06.22-.17l.05-.2.05-.18c.36-.05.64-.13.82-.21.15-.08.24-.16.28-.25a.26.26 0 0 0 .03-.09.2.2 0 0 0-.17-.2c-1.12-.2-1.63-1.36-1.65-1.41v-.01c-.06-.12-.07-.22-.04-.3.06-.14.3-.21.45-.26l.12-.05a.94.94 0 0 0 .34-.2c.08-.09.1-.18.1-.23 0-.14-.1-.26-.27-.32a.48.48 0 0 0-.18-.03.4.4 0 0 0-.17.03.95.95 0 0 1-.35.1.31.31 0 0 1-.12-.02l.01-.17V7.1a4.3 4.3 0 0 0-.1-1.73 2.2 2.2 0 0 0-.52-.74 2.2 2.2 0 0 0-1.57-.62z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="yelp-icon" viewbox="0 0 22 23">
                                            <path clip-rule="evenodd" d="M11 .876c-6.001 0-11 4.999-11 11 0 6.002 4.999 11 11 11s11-4.998 11-11c0-6.001-4.999-11-11-11z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                            <path clip-rule="evenodd" d="M10.636 4.94a6.049 6.049 0 0 0-2.505.737c-.397.215-.444.455-.208.853.82 1.38 1.64 2.76 2.465 4.138.086.144.19.284.31.395.298.275.675.157.78-.245.033-.13.042-.268.05-.387l.01-.133-.09-1.421c-.071-1.137-.142-2.254-.215-3.37-.029-.443-.177-.593-.597-.566zm2.35 7.374a.766.766 0 0 0 .107-.018l.554-.146c.681-.18 1.362-.36 2.042-.546.38-.103.502-.332.364-.724a4.9 4.9 0 0 0-1.185-1.881c-.287-.283-.54-.251-.771.08-.36.51-.716 1.025-1.072 1.54-.18.261-.36.522-.542.783a.54.54 0 0 0-.039.587c.103.204.264.323.5.33l.042-.005zm-2.88-.142c.257.112.37.305.36.587-.012.267-.136.436-.403.526l-.215.073c-.785.266-1.57.532-2.356.79-.342.112-.557-.011-.634-.386-.089-.757-.035-1.824.054-2.242.098-.462.34-.577.752-.402.816.348 1.63.7 2.443 1.054zm5.752 2.243-.562-.2c-.697-.247-1.394-.495-2.092-.74-.215-.076-.402-.008-.545.175-.15.191-.216.414-.087.638.501.87 1.009 1.736 1.522 2.598.124.209.321.254.534.146a1.11 1.11 0 0 0 .253-.177 5.28 5.28 0 0 0 1.18-1.602c.039-.082.064-.171.09-.26l.036-.123c-.012-.242-.127-.383-.329-.454zm-4.691-.313c.223.094.326.258.327.538.002.338.002.677.001 1.016v.43h-.015v.436c.001.337.002.674-.002 1.011-.003.366-.18.561-.521.525a4.275 4.275 0 0 1-2.095-.815c-.285-.208-.308-.475-.087-.758.584-.748 1.174-1.49 1.766-2.23.166-.208.387-.254.626-.153z" fill-rule="evenodd" style="fill:var(--background-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="cash-app-logo-icon" viewbox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C20 4.56 20 6.24 20 9.6v.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C15.44 20 13.76 20 10.4 20h-.8c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 15.44 0 13.76 0 10.4v-.8z" fill="var(--color-cash-app)"></path>
                                            <path clip-rule="evenodd" d="M10.52 6.853c1.036 0 2.029.42 2.678.995.164.146.41.145.564-.01l.772-.784a.403.403 0 0 0-.02-.587 6.105 6.105 0 0 0-2.07-1.164l.243-1.153a.405.405 0 0 0-.396-.488H10.8a.405.405 0 0 0-.396.32l-.218 1.026c-1.983.1-3.665 1.089-3.665 3.12 0 1.758 1.391 2.511 2.86 3.033 1.39.521 2.124.715 2.124 1.449 0 .753-.733 1.197-1.816 1.197-.986 0-2.02-.325-2.821-1.116a.403.403 0 0 0-.566-.001l-.83.818a.407.407 0 0 0 .002.582c.647.628 1.467 1.082 2.401 1.337l-.227 1.068a.405.405 0 0 0 .393.49l1.494.01a.404.404 0 0 0 .399-.321l.216-1.027c2.375-.147 3.828-1.438 3.828-3.327 0-1.739-1.448-2.473-3.207-3.072-1.004-.367-1.874-.618-1.874-1.371 0-.734.812-1.024 1.623-1.024z" fill="#fff" fill-rule="evenodd"></path>
                                        </symbol>
                                        <symbol fill="none" id="square-pay-logo-icon" viewbox="0 0 52 19" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="19" width="52" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M14.159 0H2.84A2.84 2.84 0 0 0 0 2.84v11.318A2.842 2.842 0 0 0 2.841 17H14.16A2.842 2.842 0 0 0 17 14.158V2.84A2.84 2.84 0 0 0 14.159 0zm-.25 13.013a.896.896 0 0 1-.896.896H3.989a.897.897 0 0 1-.896-.896V3.988a.896.896 0 0 1 .896-.897h9.024a.897.897 0 0 1 .896.897v9.025z" fill="var(--icon-fill)"></path>
                                                <path d="M6.694 10.806a.514.514 0 0 1-.514-.516V6.687a.514.514 0 0 1 .514-.517h3.612a.515.515 0 0 1 .514.517v3.603a.516.516 0 0 1-.514.516H6.694z" fill="var(--icon-fill)"></path>
                                                <path d="M23.744 15.5v-4.716h2.178c2.934 0 4.59-1.35 4.59-3.942S28.856 2.9 25.922 2.9h-4.626v12.6h2.448zm0-10.548h2.25c1.26 0 2.088.648 2.088 1.89s-.828 1.89-2.088 1.89h-2.25v-3.78zM34.865 15.68c1.386 0 2.286-.648 2.736-1.728h.145V15.5h2.213V8.804c0-1.944-1.404-2.988-3.96-2.988-2.088 0-3.672 1.116-3.924 2.916h2.268c.162-.738.792-1.152 1.656-1.152.99 0 1.602.54 1.602 1.386v.846l-2.231.162c-2.197.162-3.492 1.152-3.492 2.952 0 1.62 1.206 2.754 2.987 2.754zm.756-1.728c-.846 0-1.35-.504-1.35-1.206 0-.72.505-1.206 1.512-1.278l1.819-.144v.396c0 1.332-.792 2.232-1.98 2.232zm8.382 4.932c1.764 0 2.754-.612 3.402-2.448l3.618-10.44h-2.232l-1.8 5.472-.342 1.332h-.144l-.324-1.332-1.836-5.472h-2.358l3.528 9.612-.18.504c-.234.594-.612.828-1.386.828h-1.332v1.944h1.386z" fill="var(--icon-fill)" fill-opacity=".95"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="close-icon" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <rect height="20.587" rx=".936" style="fill:var(--icon-fill)" transform="scale(.99243 1.00751) rotate(45 4.622 24.714)" width="1.872"></rect>
                                            <rect height="20.587" rx=".936" style="fill:var(--icon-fill)" transform="matrix(-.70176 .71242 .70176 .71242 5.313 4)" width="1.872"></rect>
                                        </symbol>
                                        <symbol fill="none" id="shopping-bag-icon" viewbox="0 0 33 33">
                                            <circle cx="16.5" cy="16.5" fill="var(--background-fill)" fill-opacity=".4" r="16.5"></circle>
                                            <path clip-rule="evenodd" d="M14.836 15a1 1 0 0 1-2 0h1-1v-.026l.001-.065a24.537 24.537 0 0 1 .054-1.273h-2.143L10 23.134h12.673l-.748-9.498h-2.143a29.311 29.311 0 0 1 .05 1.038l.004.236V14.998l-1 .001h1a1 1 0 0 1-2 0v-.067l-.004-.208a22.363 22.363 0 0 0-.055-1.089h-2.881a23.613 23.613 0 0 0-.059 1.297V15zm.305-3.364h2.391c-.15-.823-.359-1.56-.632-2.07-.287-.537-.493-.566-.563-.566-.071 0-.277.03-.564.566-.273.51-.483 1.246-.632 2.07zm4.42 0h2.364a2 2 0 0 1 1.994 1.843l.748 9.498a2 2 0 0 1-1.994 2.157H10a2 2 0 0 1-1.994-2.157l.748-9.498a2 2 0 0 1 1.994-1.843h2.364c.016-.103.034-.207.053-.312.162-.91.419-1.908.845-2.702C14.425 7.846 15.157 7 16.337 7c1.179 0 1.91.846 2.326 1.622.426.794.683 1.792.845 2.702.019.104.037.209.053.312z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                        </symbol>
                                        <symbol fill="none" id="ellipse-icon" viewbox="0 0 4 4" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="4" width="4" xmlns="http://www.w3.org/2000/svg">
                                                <circle cx="2" cy="2" fill="var(--icon-fill)" r="2"></circle>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="tag-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path clip-rule="evenodd" d="M15.707 5.107c.777-.776 2.05-1.564 3.488-2.158C20.63 2.356 22.122 2 23.3 2H34c2.188 0 4 1.691 4 3.9v10.7c0 1.166-.374 2.625-.992 4.052-.615 1.418-1.429 2.707-2.226 3.552l-8.05 8.114L7.615 13.2l8.092-8.093zM6.2 14.614l19.124 19.123-3.131 3.156-.001.001a3.889 3.889 0 0 1-5.485-.001l-.005-.006-.025-.025-.099-.1-.374-.377-1.352-1.363-4.23-4.264a4953.029 4953.029 0 0 0-7.515-7.565 3.889 3.889 0 0 1 0-5.486L6.2 14.614zm9.09 23.69L16 37.6l-.71.704-.002-.002-.007-.007-.025-.025-.098-.099-.374-.378-1.352-1.362-4.23-4.264a4998 4998 0 0 0-7.509-7.56 5.889 5.889 0 0 1 0-8.314l12.6-12.6c1.023-1.024 2.55-1.936 4.138-2.592C20.019.444 21.778 0 23.3 0H34c3.211 0 6 2.509 6 5.9v10.7c0 1.534-.477 3.275-1.158 4.848-.684 1.577-1.617 3.084-2.617 4.14l-.016.016-12.6 12.7-.003.003a5.889 5.889 0 0 1-8.314 0l-.003-.003zM35 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="digital-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M35 8h.974a.974.974 0 0 0-.285-.689l-.69.689zm-7-7 .689-.689a.974.974 0 0 0-.69-.285V1zm6 33.026H10v1.948h24v-1.948zm-24 0c-.042 0-.06-.007-.06-.007s.003 0 .008.004a.1.1 0 0 1 .03.03l.003.007s-.007-.018-.007-.06H8.026c0 .521.178 1.032.56 1.414.382.382.893.56 1.414.56v-1.948zM9.974 34V2H8.026v32h1.948zm0-32 .001-.011c-.001.003-.001.002.002-.002a.058.058 0 0 1 .018-.01c.007-.003.01-.003.005-.003V.026C9.026.026 8.026.8 8.026 2h1.948zm24.051 32v.011c0-.003.001-.002-.002.002a.06.06 0 0 1-.018.01c-.007.003-.01.003-.005.003v1.948c.974 0 1.974-.774 1.974-1.974h-1.949zm1.95 0V8h-1.95v26h1.95zm-.286-26.689-7-7-1.378 1.378 7 7 1.378-1.378zM27.999.026H10v1.948h18V.026z" fill="var(--icon-fill)"></path>
                                                <path d="M28 1v7h7" stroke="var(--icon-fill)" stroke-linejoin="round" stroke-width="1.949"></path>
                                                <path d="M31 37.998h.974a.974.974 0 0 1-.069.36l-.905-.36zM8.5 3.924a.974.974 0 1 1 0 1.949V3.924zM6 5.873a.18.18 0 0 0-.058.007l.007-.005a.1.1 0 0 0 .03-.029l.003-.006s-.007.02-.007.061h-1.95c0-.521.178-1.032.56-1.415.382-.383.893-.562 1.415-.562v1.949zm-.025.028v32.097h-1.95V5.901h1.95zm0 32.097v.012c0 .001 0 .001 0 0l.004.004a.06.06 0 0 0 .017.01c.007.003.009.003.004.003v1.948c-.976 0-1.974-.778-1.974-1.977h1.949zm.025.029h24v1.948H6v-1.948zm24 0c-.132 0-.2.056-.186.046a.657.657 0 0 0 .112-.131 1.808 1.808 0 0 0 .17-.31c.001 0 .001 0 0 0v.004c-.001 0-.001.001.904.362l.905.361v.002l-.002.002a.374.374 0 0 1-.002.006l-.007.017a2.646 2.646 0 0 1-.094.203 3.73 3.73 0 0 1-.276.468 2.54 2.54 0 0 1-.52.559 1.64 1.64 0 0 1-1.004.36v-1.95zm1-.029h-.974v-3.009h1.948v3.009H31zM6 3.924h2.5v1.949H6V3.924z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="service-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m15 8 .74.673a1 1 0 0 0-.033-1.38L15 8zM5 19l-.707.707a1 1 0 0 0 1.447-.034L5 19zm-3-3-.74-.673a1 1 0 0 0 .033 1.38L2 16zM12 5l.707-.707a1 1 0 0 0-1.447.034L12 5zm13 3-.707-.707a1 1 0 0 0-.033 1.38L25 8zm10 11-.74.673a1 1 0 0 0 1.447.034L35 19zm3-3 .707.707a1 1 0 0 0 .033-1.38L38 16zM28 5l.74-.673a1 1 0 0 0-1.447-.034L28 5zM9 28.9l-.707.707.049.046L9 28.9zm0-2.8-.707-.707L9 26.1zm3.5-3.5.707.707-.707-.707zm4.9 11.9-.707-.707a.994.994 0 0 0-.046.049l.753.658zm11.8-5.6.707-.707a1.075 1.075 0 0 0-.026-.026l-.68.733zM32 26l.753-.659a.994.994 0 0 0-.046-.048L32 26zm-1.793-3.207a1 1 0 0 0-1.414 1.414l1.414-1.414zm-3.1 8.2a1 1 0 0 0-1.414 1.414l1.415-1.414zm1.374-4.126a1 1 0 0 0-1.361 1.466l1.36-1.466zm-6.774 4.426a1 1 0 0 0-1.414 1.414l1.414-1.414zM26 34.7l-.573-.82a.995.995 0 0 0-.027.02l.6.8zm.3-3-.733.68.026.027.707-.707zm-.567-2.08a1 1 0 0 0-1.466 1.36l1.466-1.36zM6.707 17.293a1 1 0 0 0-1.414 1.414l1.414-1.414zm3.586 6.414a1 1 0 0 0 1.414-1.414l-1.414 1.414zM19 16l-.287-.958a.507.507 0 0 0-.018.006L19 16zm4 1 .707-.707a1.011 1.011 0 0 0-.082-.074L23 17zm-8.74-9.673-10 11 1.48 1.346 10-11-1.48-1.346zM5.707 18.293l-3-3-1.414 1.414 3 3 1.414-1.414zm-2.967-1.62 10-11-1.48-1.346-10 11 1.48 1.346zm8.553-10.966 3 3 1.414-1.414-3-3-1.414 1.414zM24.26 8.673l10 11 1.48-1.346-10-11-1.48 1.346zm11.447 11.034 3-3-1.414-1.414-3 3 1.414 1.414zm3.033-4.38-10-11-1.48 1.346 10 11 1.48-1.346zM27.293 4.293l-3 3 1.414 1.414 3-3-1.414-1.414zm-17.585 23.9c-.41-.41-.41-.976 0-1.386l-1.415-1.414c-1.19 1.19-1.19 3.024 0 4.214l1.415-1.414zm0-1.386 3.5-3.5-1.415-1.414-3.5 3.5 1.415 1.414zm3.5-3.5c.409-.41.976-.41 1.385 0l1.415-1.414c-1.191-1.19-3.024-1.19-4.215 0l1.415 1.414zm1.385 0c.41.41.41.976 0 1.386l1.415 1.414c1.19-1.19 1.19-3.024 0-4.214l-1.415 1.414zm0 1.386-3.5 3.5 1.415 1.414 3.5-3.5-1.415-1.414zm-3.451 3.454a1.13 1.13 0 0 1-1.483 0l-1.317 1.506a3.13 3.13 0 0 0 4.117 0l-1.317-1.506zm1.365 2.846c-.409-.41-.41-.976 0-1.386l-1.414-1.414c-1.19 1.19-1.19 3.023 0 4.214l1.414-1.414zm3.5-4.886c.41-.41.977-.41 1.386 0l1.414-1.414c-1.19-1.19-3.023-1.19-4.214 0l1.415 1.414zm1.386 0c.41.41.41.977 0 1.386l1.414 1.414c1.19-1.19 1.19-3.023 0-4.214l-1.414 1.414zm0 1.386-3.5 3.5 1.414 1.414 3.5-3.5-1.414-1.414zm-3.545 3.549c-.277.316-.903.388-1.34-.05l-1.415 1.415c1.162 1.163 3.137 1.235 4.26-.048l-1.505-1.318zm1.46 2.751c-.41-.41-.41-.976 0-1.386l-1.415-1.414c-1.19 1.19-1.19 3.024 0 4.214l1.414-1.414zm3.5-4.886c.409-.41.975-.41 1.385 0l1.414-1.414c-1.19-1.19-3.023-1.19-4.214 0l1.414 1.414zm1.385 0c.41.41.41.977 0 1.386l1.414 1.414c1.19-1.19 1.19-3.024 0-4.214l-1.414 1.414zm0 1.386-3.5 3.5 1.414 1.414 3.5-3.5-1.414-1.414zm-3.546 3.549c-.277.316-.902.389-1.34-.049l-1.414 1.414c1.162 1.163 3.137 1.235 4.26-.048l-1.506-1.317zm11.846-4.235c1.19 1.19 3.024 1.19 4.214 0l-1.414-1.414c-.41.41-.976.41-1.386 0l-1.414 1.414zm4.214 0c1.374-1.373.99-3.187.046-4.265l-1.505 1.317c.456.52.472 1.107.045 1.534l1.414 1.414zm0-4.314-2.5-2.5-1.414 1.414 2.5 2.5 1.414-1.414zm-7.014 7.114c1.19 1.19 3.024 1.19 4.214 0l-1.414-1.414c-.41.41-.976.41-1.385 0l-1.415 1.414zm4.214 0c1.191-1.19 1.19-3.024 0-4.214l-1.414 1.414c.41.41.41.977 0 1.386l1.415 1.414zm-.026-4.24-1.4-1.3-1.361 1.466 1.4 1.3 1.36-1.466zm-9.588 4.54 2.4 2.4 1.414-1.414-2.4-2.4-1.414 1.414zm2.4 2.4c.97.97 2.623 1.356 3.907.393l-1.2-1.6c-.316.237-.863.223-1.293-.207l-1.414 1.414zm3.88.412c1.508-1.055 1.676-3.284.434-4.526l-1.414 1.414c.358.359.326 1.129-.166 1.474l1.146 1.638zm.46-4.5-1.3-1.4-1.466 1.361 1.3 1.4 1.466-1.36zM5.293 18.708l5 5 1.414-1.414-5-5-1.414 1.414zM26 9l-.707-.707h-.001v.001h-.001v.001l-.001.001-.001.001h-.001v.001l-.001.001h-.001V8.3l-.002.001v.001h-.001l-.001.002-.002.002-.002.002-.002.002h-.001a.13.13 0 0 0-.006.007l-.002.001v.002l-.002.001-.002.002a.103.103 0 0 0-.004.004l-.002.002-.001.001-.002.002-.002.001-.001.002-.002.002-.002.002-.002.001c0 .001 0 .002-.002.002l-.001.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.003.002-.002.003-.002.002-.002.002-.003.002-.002.003-.002.002-.002.002a.272.272 0 0 0-.005.005l-.003.003-.002.002-.003.003-.002.002-.003.003-.002.002-.003.003-.003.003-.003.002-.002.003-.003.003-.003.002-.003.003-.002.003-.003.003a.072.072 0 0 0-.003.003l-.003.003a.073.073 0 0 0-.003.003l-.003.003-.003.003a.853.853 0 0 0-.003.003l-.003.003-.003.003a.1.1 0 0 1-.003.003l-.003.003-.003.003-.003.003-.003.003a.493.493 0 0 0-.007.007l-.003.003a.108.108 0 0 1-.007.007l-.003.003a1956203611.42 1956203611.42 0 0 0-.007.007l-.003.003-.004.004-.003.003-.004.003c0 .002-.002.003-.003.004l-.004.004a1.197 1.197 0 0 0-.003.003l-.004.004-.003.003-.004.004-.004.003c0 .002-.002.003-.003.004a.117.117 0 0 0-.008.008l-.004.003-.003.004-.004.004-.004.004-.004.003c0 .002-.002.003-.003.004a1.407 1.407 0 0 0-.004.004l-.004.004a.717.717 0 0 0-.004.004l-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004a.152.152 0 0 1-.008.008l-.004.004-.004.004-.004.004-.004.004a.16.16 0 0 0-.005.004c0 .002-.002.003-.004.005l-.004.004-.004.004-.004.004-.005.004-.004.005-.004.004a.175.175 0 0 1-.005.004c0 .002-.002.003-.004.005l-.004.004-.005.004c0 .002-.002.003-.004.005l-.004.004-.005.004-.004.005a.167.167 0 0 0-.004.004l-.005.005-.005.004-.004.005a1.916 1.916 0 0 0-.005.004l-.004.005-.005.004-.004.005-.005.004-.004.005-.005.005-.005.004-.004.005-.005.005-.004.004a.173.173 0 0 0-.005.005l-.005.005a.208.208 0 0 0-.01.009c0 .002-.002.003-.004.005a.21.21 0 0 0-.005.005l-.005.004-.004.005-.005.005-.005.005-.005.005-.005.004a.225.225 0 0 0-.004.005l-.005.005a.205.205 0 0 0-.005.005l-.005.005-.005.005-.005.005-.005.005-.005.004-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005a2.416 2.416 0 0 0-.005.005l-.005.006a1.215 1.215 0 0 0-.005.005l-.005.005a2.445 2.445 0 0 0-.01.01l-.005.005a2.467 2.467 0 0 0-.005.005l-.005.005-.006.005-.005.005-.005.006-.005.005-.005.005-.005.005-.006.005-.005.006-.005.005-.005.005a.233.233 0 0 0-.005.005l-.006.005-.005.006-.005.005-.005.005-.006.005a.294.294 0 0 1-.005.006l-.005.005a.265.265 0 0 0-.021.021l-.006.006-.005.005a.265.265 0 0 1-.01.01l-.006.006a.266.266 0 0 1-.016.016l-.006.005a.242.242 0 0 0-.005.006l-.005.005-.006.005-.005.006a2.742 2.742 0 0 0-.016.016l-.005.005-.006.006-.005.005-.006.006-.005.005a2.765 2.765 0 0 1-.006.005l-.005.006-.005.005a.283.283 0 0 0-.006.006l-.005.005-.006.006-.005.005-.006.005-.005.006-.005.005-.006.006a.284.284 0 0 0-.005.005l-.006.006a.284.284 0 0 0-.005.005l-.006.006-.005.005a.284.284 0 0 1-.011.01l-.006.006-.005.006-.005.005-.006.006a2.803 2.803 0 0 1-.005.005l-.006.006-.005.005-.006.006-.005.005-.006.006a.284.284 0 0 0-.01.01l-.006.006-.006.005-.005.006-.006.005-.005.006-.005.005a.284.284 0 0 1-.006.006l-.005.005-.006.006-.005.005a.284.284 0 0 1-.006.005l-.005.006a.284.284 0 0 1-.006.005l-.005.006-.005.005-.006.006-.005.005-.006.006a.283.283 0 0 1-.005.005l-.006.005a2.765 2.765 0 0 1-.005.006l-.005.005-.006.006a2.757 2.757 0 0 1-.005.005l-.006.005-.005.006-.005.005-.006.006-.005.005-.006.005-.005.006-.005.005a.267.267 0 0 1-.006.006l-.005.005a.266.266 0 0 0-.005.005l-.006.006a.242.242 0 0 0-.005.005l-.006.005-.005.006a2.696 2.696 0 0 1-.005.005l-.005.005-.006.006-.005.005-.005.005-.006.006-.005.005-.005.005a.264.264 0 0 1-.006.005l-.005.006-.005.005a.24.24 0 0 1-.005.005l-.006.005-.005.006-.005.005-.005.005-.006.005-.005.006-.005.005-.005.005-.005.005a.231.231 0 0 1-.005.005l-.006.005-.005.006-.005.005a.253.253 0 0 1-.005.005l-.005.005-.005.005-.005.005-.006.005a2.445 2.445 0 0 1-.005.005l-.005.005-.005.006-.005.005-.005.005a2.402 2.402 0 0 1-.015.015l-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.004-.005.005-.005.005-.004.005-.005.005-.005.005a.205.205 0 0 1-.01.01l-.005.004a2.179 2.179 0 0 1-.014.015l-.005.005-.005.004-.004.005-.005.005a2.119 2.119 0 0 1-.01.01l-.004.004-.005.005-.005.004-.004.005-.005.005-.004.004a.181.181 0 0 1-.01.01l-.004.004a.18.18 0 0 1-.005.004l-.004.005a1.922 1.922 0 0 1-.005.005l-.004.004-.005.004-.004.005-.005.004-.004.005a.183.183 0 0 1-.005.004c0 .002-.002.003-.004.005a.182.182 0 0 1-.004.004l-.005.004-.004.005-.004.004-.005.004-.004.005-.004.004-.005.004c0 .002-.002.003-.004.004l-.004.005-.004.004-.004.004-.005.004c0 .002-.002.003-.004.004l-.004.005-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004a8491334680.957 8491334680.957 0 0 1-.008.008l-.004.004-.004.004-.004.004-.004.003c0 .002-.002.003-.003.004l-.004.004-.004.004-.004.004-.004.003c0 .002-.002.003-.003.004l-.004.004a3633073655.432 3633073655.432 0 0 0-.008.007c0 .002-.002.003-.003.004l-.004.004-.003.003-.004.004-.004.003-.003.004-.003.003-.004.004-.003.003-.004.004a3250884297.246 3250884297.246 0 0 0-.01.01l-.003.003-.004.004-.003.003-.003.003-.004.003a2716058231.859 2716058231.859 0 0 1-.006.007l-.003.003-.003.003-.003.003-.004.003-.003.004-.003.003-.003.003-.003.003-.003.002c0 .002-.002.002-.003.003l-.003.003-.002.003-.003.003-.003.003-.003.003-.003.003-.003.002-.002.003-.003.003-.003.002-.002.003-.003.003-.002.002-.003.003-.003.002-.002.003-.003.002-.002.003-.002.002-.003.002-.002.003-.002.002-.003.002-.002.003-.002.002-.002.002-.003.002-.002.003-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.001.001-.002.002-.002.002 1.414 1.414.002-.002.002-.002.002-.001.001-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.003-.002.002-.003.002-.002.002-.002.002-.002.003-.003.002-.002.003-.002.002-.003.002-.002.003-.002.002-.003.003-.003.002-.002.003-.003.002-.002.003-.003.003-.002.002-.003.003-.003.003-.002a.037.037 0 0 0 .003-.003l.002-.003.003-.003.003-.003.003-.003.003-.002a.08.08 0 0 1 .003-.003l.003-.003.003-.003.003-.003.003-.003a.09.09 0 0 1 .006-.006l.003-.004.003-.003a.092.092 0 0 1 .003-.003l.003-.003.003-.003.004-.003c0-.002.002-.003.003-.004l.003-.003.003-.003a2889930025.631 2889930025.631 0 0 1 .007-.007l.003-.003a.055.055 0 0 1 .004-.004l.003-.003.004-.003c0-.002.002-.003.003-.004l.004-.003c0-.002.002-.003.003-.004l.004-.004a3439172743.957 3439172743.957 0 0 0 .007-.007l.003-.003.004-.004.004-.003.003-.004.004-.004.004-.004a.13.13 0 0 1 .004-.003c0-.002.002-.003.003-.004l.004-.004.004-.004.004-.004.004-.003c0-.002.002-.003.004-.004 0-.002.002-.003.003-.004a.149.149 0 0 1 .008-.008l.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.005-.004c0-.002.002-.003.004-.004l.004-.005.004-.004.004-.004.004-.004.005-.004a.172.172 0 0 1 .008-.009l.004-.004.005-.004.004-.005.004-.004.005-.004a.18.18 0 0 1 .004-.005l.004-.004.005-.005.004-.004.005-.004.004-.005.005-.004.004-.005.004-.004.005-.005a.197.197 0 0 1 .005-.004l.004-.005.005-.005a.197.197 0 0 1 .013-.013l.005-.005a3743849765.858 3743849765.858 0 0 0 .01-.01l.004-.004a.104.104 0 0 1 .01-.01l.004-.004.005-.005.005-.004.004-.005.005-.005.005-.005.005-.005.005-.004.004-.005.005-.005.005-.005.005-.005.005-.005.005-.005a.229.229 0 0 1 .01-.01l.005-.004.004-.005.005-.005a.233.233 0 0 1 .005-.005l.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005a.118.118 0 0 0 .005-.005l.006-.005.005-.005.005-.005.005-.005.005-.006.005-.005.005-.005a.253.253 0 0 1 .005-.005l.005-.005.005-.005.006-.005a.253.253 0 0 1 .005-.006l.005-.005.005-.005.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006.005-.005.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006a.267.267 0 0 1 .005-.005l.006-.005a.267.267 0 0 1 .005-.006l.005-.005a.267.267 0 0 1 .006-.005l.005-.006.006-.005.005-.006a.267.267 0 0 1 .005-.005l.006-.005.005-.006.005-.005.006-.006.005-.005.006-.005.005-.006.005-.005.006-.006.005-.005.006-.005.005-.006.006-.005.005-.006.005-.005a.143.143 0 0 0 .006-.006l.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006.005-.005.006-.006.005-.005.006-.006.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006.006-.005a.283.283 0 0 1 .005-.006l.005-.005.006-.006.005-.005a.283.283 0 0 1 .006-.006l.005-.005a.143.143 0 0 0 .006-.006l.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006.006-.005.005-.006.006-.005a.283.283 0 0 1 .005-.006l.005-.005.006-.006.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006a.143.143 0 0 0 .006-.005l.005-.006.005-.005.006-.006.005-.005.006-.005.005-.006a.283.283 0 0 1 .006-.005l.005-.006.005-.005.006-.005.005-.006.006-.005.005-.006.005-.005.006-.005.005-.006.005-.005.006-.005.005-.006.006-.005a.267.267 0 0 1 .005-.006l.005-.005.005-.005.006-.006.005-.005a.267.267 0 0 1 .01-.01l.006-.006.005-.005.006-.005a.262.262 0 0 1 .01-.011l.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005a.253.253 0 0 1 .005-.005l.006-.005a.253.253 0 0 1 .005-.005l.005-.006.005-.005a.253.253 0 0 1 .005-.005l.005-.005.005-.005.005-.005.005-.005.006-.005a.238.238 0 0 1 .005-.005l.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.004-.005.005-.005.005-.005.005-.005.005-.005a.224.224 0 0 1 .005-.005l.005-.005.005-.004.004-.005.005-.005.005-.005.005-.005.005-.004.004-.005a.21.21 0 0 1 .01-.01l.004-.004.005-.005.005-.005a.206.206 0 0 1 .004-.004l.005-.005.005-.004.004-.005.005-.005.004-.004.005-.005.005-.004.004-.005.005-.004.004-.005.005-.005.004-.004.005-.005.004-.004.005-.004.004-.005.004-.004.005-.005.004-.004.004-.004.005-.005.004-.004.004-.004.005-.004.004-.005.004-.004.004-.004.005-.004c0-.002.002-.003.004-.004l.004-.005.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004a.153.153 0 0 1 .004-.004l.004-.004a.149.149 0 0 1 .008-.008.136.136 0 0 1 .008-.008 8072996200.381 8072996200.381 0 0 0 .008-.008l.004-.004.004-.003c0-.002.002-.003.004-.004 0-.002.002-.003.003-.004l.004-.004.004-.004.003-.003.004-.004.004-.004a.626.626 0 0 1 .004-.003c0-.002.002-.003.003-.004l.004-.004.003-.003.004-.004a.116.116 0 0 1 .01-.01l.004-.004.004-.003a.1.1 0 0 1 .003-.004l.003-.003a.109.109 0 0 1 .004-.003c0-.002.002-.003.003-.004l.003-.003a1.031 1.031 0 0 1 .014-.013l.003-.003c0-.002.002-.003.003-.004a.096.096 0 0 0 .003-.003l.003-.003.003-.003.003-.003.003-.003a.866.866 0 0 1 .006-.006l.003-.003a.832.832 0 0 1 .003-.003l.003-.003.003-.003.003-.003.003-.003.003-.003.003-.002.002-.003.003-.003.003-.003.002-.002.003-.003.003-.002.002-.003.003-.003.002-.002.003-.003.002-.002.003-.003.002-.002.003-.002.002-.003.002-.002.003-.003.002-.002.002-.002.003-.002c0-.001 0-.002.002-.002l.002-.003.002-.002.002-.002.002-.002a.2.2 0 0 1 .002-.002l.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002a.155.155 0 0 1 .003-.003l.002-.002.002-.002.002-.001.001-.002.002-.002.001-.001.002-.002.002-.001.001-.002.002-.001v-.002l.002-.001.002-.001.001-.002.001-.001.002-.001v-.002a.134.134 0 0 1 .004-.003l.001-.001.001-.001.001-.001.001-.001.001-.001.001-.001h.001v-.002h.002v-.001l.001-.001.002-.001v-.001l.001-.001.001-.001.001-.001h.001v-.001h.001L26 9zm-2.707 1.293c.173-.173.343-.193.27-.176a1.45 1.45 0 0 1-.208.026c-.234.018-.56.02-.949.007-.772-.024-1.67-.096-2.33-.147l-.153 1.994c.641.05 1.593.127 2.42.152.412.013.823.015 1.164-.011.169-.013.35-.035.52-.075.121-.029.432-.108.68-.356l-1.414-1.414zm-3.216-.29c-.515-.04-1.053.08-1.527.23-.489.155-.997.373-1.478.6-.482.229-.961.478-1.388.7-.437.229-.805.422-1.103.559l.838 1.816c.352-.163.771-.382 1.19-.601.43-.225.876-.456 1.319-.665.444-.21.86-.386 1.228-.503.383-.121.632-.152.767-.142l.154-1.994zm-5.496 2.089c-.692.32-1.356.747-1.664 1.414-.354.768-.096 1.494.235 2.024l1.696-1.06a.699.699 0 0 1-.1-.208c0-.002.001.01-.001.03a.181.181 0 0 1-.014.052c-.01.02.002-.019.112-.106.111-.088.292-.2.574-.33l-.838-1.816zm-1.429 3.438c.427.684 1.31 1.242 2.323 1.531 1.06.303 2.386.353 3.83-.109l-.61-1.904c-1.056.338-1.98.288-2.67.09-.737-.21-1.104-.552-1.177-.668l-1.696 1.06zm6.135 1.428c.677-.203 1.416-.047 2.065.235a5.393 5.393 0 0 1 1.018.584l.008.006h-.001v-.001h-.001L23 17c.625-.78.624-.781.624-.781l-.002-.002-.003-.002-.009-.007-.026-.02a6.368 6.368 0 0 0-.387-.27 7.42 7.42 0 0 0-1.05-.56c-.85-.369-2.111-.713-3.434-.316l.574 1.916zm3.006.75 8 8 1.414-1.415-8-8-1.414 1.414zm-9-8 3 3 1.414-1.415-3-3-1.414 1.414zm20 7.585-4.5 4.5 1.414 1.414 4.5-4.5-1.414-1.414z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="donation-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M2 19a1 1 0 1 0 0 2v-2zm36 2a1 1 0 1 0 0-2v2zM21 8a1 1 0 1 0-2 0h2zm-2 24a1 1 0 1 0 2 0h-2zm7-13.7-.676-.737a.892.892 0 0 0-.031.03L26 18.3zm-12 0 .708-.707a.986.986 0 0 0-.032-.03l-.675.737zm0 4.7a1 1 0 1 0 0 2v-2zm12 2a1 1 0 1 0 0-2v2zM2 21h36v-2H2v2zM19 8v24h2V8h-2zm6.293 9.593c-.099.099-.415.283-1.02.49-.559.193-1.23.361-1.892.501a32.888 32.888 0 0 1-2.491.422l-.01.001h-.001L20 20l.122.993h.001l.004-.001c.003 0 .007 0 .012-.002.01 0 .025-.003.044-.005a27.755 27.755 0 0 0 .752-.108 35.006 35.006 0 0 0 1.859-.336c.7-.148 1.46-.336 2.13-.566.623-.214 1.332-.517 1.783-.968l-1.414-1.414zM20 20l.925.38v-.002l.004-.008.013-.03.05-.121c.045-.105.11-.258.192-.445.163-.375.392-.885.654-1.427a23.39 23.39 0 0 1 .839-1.596c.297-.508.55-.864.73-1.044l-1.414-1.414c-.37.37-.73.914-1.042 1.447a25.492 25.492 0 0 0-.914 1.737 43.527 43.527 0 0 0-.957 2.13l-.004.01v.002l-.001.001L20 20zm3.407-4.293a2.28 2.28 0 0 1 1.328-.663c.446-.05.77.074.958.263l1.414-1.414c-.711-.712-1.688-.937-2.592-.837-.907.1-1.816.53-2.522 1.237l1.414 1.414zm2.286-.4c.404.405.515 1.446-.369 2.256l1.352 1.474c1.516-1.39 1.827-3.749.431-5.144l-1.414 1.414zm-12.4 3.7c.452.451 1.161.754 1.784.968.669.23 1.429.418 2.13.566a35.003 35.003 0 0 0 2.61.444l.044.005.012.002h.005L20 20l.122-.993h-.003l-.008-.001a4.733 4.733 0 0 1-.189-.025 32.903 32.903 0 0 1-2.303-.397 16.575 16.575 0 0 1-1.892-.5c-.605-.208-.92-.392-1.02-.491l-1.414 1.414zM20 20l.925-.38-.001-.003-.004-.01a5.06 5.06 0 0 0-.07-.165 43.862 43.862 0 0 0-.887-1.964 25.3 25.3 0 0 0-.914-1.738c-.312-.533-.67-1.077-1.041-1.447l-1.415 1.414c.18.18.433.536.73 1.044.287.488.577 1.053.84 1.596a41.814 41.814 0 0 1 .908 2.023l.003.008v.001L20 20zm-1.992-5.707a4.278 4.278 0 0 0-2.522-1.237c-.905-.1-1.881.126-2.593.837l1.415 1.414c.188-.189.512-.313.957-.263.444.05.935.27 1.328.663l1.415-1.414zm-5.114-.4c-1.396 1.395-1.085 3.754.43 5.144l1.352-1.474c-.884-.81-.773-1.851-.368-2.256l-1.415-1.414zM20 20l-.997-.076v-.01.01a2.68 2.68 0 0 1-.093.403 3.31 3.31 0 0 1-.558 1.054C17.778 22.11 16.585 23 14 23v2c3.115 0 4.922-1.11 5.923-2.381.485-.616.75-1.23.896-1.696a4.668 4.668 0 0 0 .169-.756 2.448 2.448 0 0 0 .009-.086v-.005L20 20zm0 0-.999.051v.005l.001.008.001.02a2.604 2.604 0 0 0 .029.24c.022.147.061.346.13.581.136.468.392 1.088.873 1.708C21.028 23.895 22.842 25 26 25v-2c-2.642 0-3.828-.895-4.385-1.613a3.15 3.15 0 0 1-.533-1.042 2.558 2.558 0 0 1-.083-.398v-.009.012L20 20zM6 32c-1.546 0-2.493-.386-3.063-.964C2.365 30.454 2 29.503 2 28H0c0 1.797.435 3.346 1.513 4.44C2.593 33.535 4.146 34 6 34v-2zm-4-4V12H0v16h2zm0-16c0-1.504.365-2.454.937-3.036C3.507 8.386 4.454 8 6 8V6c-1.854 0-3.407.464-4.487 1.56C.435 8.655 0 10.205 0 12h2zm4-4h28V6H6v2zm28 0c1.546 0 2.493.386 3.063.964.572.582.937 1.532.937 3.036h2c0-1.796-.435-3.346-1.513-4.44C37.407 6.465 35.854 6 34 6v2zm4 4v16h2V12h-2zm0 16c0 1.4-.477 2.35-1.217 2.97-.766.643-1.937 1.03-3.483 1.03v2c1.854 0 3.533-.462 4.767-1.496C39.327 31.45 40 29.901 40 28h-2zm-4.7 4H6v2h27.3v-2z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="event-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m22.3 17.1 4.7.9-3.3 3.4.6 4.6-4.3-2-4.3 2 .6-4.6L13 18l4.7-.9L20 13l2.3 4.1z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"></path>
                                                <path d="M38 33H2c-.6 0-1-.4-1-1V8c0-.6.4-1 1-1h36c.6 0 1 .4 1 1v24c0 .6-.4 1-1 1z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="membership-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M23 15a1 1 0 1 0 0 2v-2zm10 2a1 1 0 1 0 0-2v2zm-10 2a1 1 0 1 0 0 2v-2zm7 2a1 1 0 1 0 0-2v2zm-7 2a1 1 0 1 0 0 2v-2zm8 2a1 1 0 1 0 0-2v2zm-15.392.51a1 1 0 0 0 1.585-1.22l-1.585 1.22zm-9-1.22a1 1 0 0 0 1.585 1.22l-1.585-1.22zM37 32H3v2h34v-2zM3 32c-.548 0-1-.452-1-1H0c0 1.652 1.348 3 3 3v-2zm-1-1V9H0v22h2zM2 9c0-.548.452-1 1-1V6C1.348 6 0 7.348 0 9h2zm1-1h34V6H3v2zm34 0c.548 0 1 .452 1 1h2c0-1.652-1.348-3-3-3v2zm1 1v22h2V9h-2zm0 22c0 .548-.452 1-1 1v2c1.652 0 3-1.348 3-3h-2zM23 17h10v-2H23v2zm0 4h7v-2h-7v2zm0 4h8v-2h-8v2zm-9.1-7a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4h-2zm-2 2a2 2 0 0 1-2-2h-2a4 4 0 0 0 4 4v-2zm-2-2a2 2 0 0 1 2-2v-2a4 4 0 0 0-4 4h2zm2-2a2 2 0 0 1 2 2h2a4 4 0 0 0-4-4v2zm5.293 8.29c-1.184-1.539-3.173-2.59-5.293-2.59v2c1.48 0 2.891.748 3.708 1.81l1.585-1.22zM11.9 21.7c-2.12 0-4.109 1.051-5.292 2.59l1.585 1.22c.816-1.062 2.227-1.81 3.707-1.81v-2z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="food-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <g clip-path="url(#clip0)">
                                                    <path d="M14.293 21.85 1.758 34.132c-1.01.99-1.01 2.972 0 3.962 1.011.99 3.033.99 4.044 0l12.737-14.859m4.145-4.953c1.214-1.283 2.528-2.675 2.528-2.675 1.718 1.684 4.288 1.392 6.47-.693 2.18-2.086 5.812-6.747 6.065-7.33.253-.585.71-1.385 0-2.081a1.487 1.487 0 0 0-2.123 0m0 0c-.1.099-.1.099 0 0zm0 0c.607-.595.607-1.486 0-2.08a1.487 1.487 0 0 0-2.123 0m2.123 2.08s-3.942 3.92-6.124 6.124m4.001-8.204c-.1.099-.1.099 0 0zm0 0c.607-.595.607-1.486 0-2.08-.606-.595-1.367-.47-2.123 0-.755.468-7.48 5.943-7.48 5.943-1.82 1.486-2.427 4.656-.708 6.34 0 0-1.61 1.34-2.83 2.476M33.5 3.423s-1.001 1.077-6 6.001M3.78 1.442S37 32 38.15 33.142c1.152 1.142.81 4.061 0 4.953-.909.892-3.74 1.486-5.054 0L22.987 24.227c-.808-.991-3.74-.991-5.054-.991-1.416 0-3.235-.892-4.044-1.981L4.791 10.358C2.97 7.98 2.162 4.018 3.78 1.442z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                                                </g>
                                                <defs>
                                                    <clippath id="clip0">
                                                        <path d="M0 0h40v40H0z" fill="var(--background-fill)"></path>
                                                    </clippath>
                                                </defs>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="image-icon" viewbox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="64" width="64" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                                <path clip-rule="evenodd" d="M28.372 28.25c1.196 0 2.166-1.007 2.166-2.25s-.97-2.25-2.166-2.25-2.166 1.007-2.166 2.25.97 2.25 2.166 2.25zm-1.288 3.913a1 1 0 0 0-1.562.154L21.42 38.71a1 1 0 0 0 .841 1.54h19.504a1 1 0 0 0 .857-1.515l-5.552-9.23a1 1 0 0 0-1.65-.094l-4.173 5.42a1 1 0 0 1-1.513.083l-2.649-2.752z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="section-icon" viewbox="0 0 16 16">
                                            <path d="M.667.057a.993.993 0 0 0-.66 1.021.96.96 0 0 0 .556.819l.201.099 7.174.008c6.45.007 7.19.003 7.336-.039.354-.103.576-.325.709-.708.052-.147.062-.42.019-.499a5.394 5.394 0 0 1-.09-.189 1.078 1.078 0 0 0-.482-.476l-.165-.078-7.22-.007C1.114.002.819.004.667.057m-.657.949c0 .115.005.159.012.097a1.238 1.238 0 0 0 0-.211C.015.839.01.89.01 1.006m.753 3.021a1.11 1.11 0 0 0-.557.368c-.219.291-.208.084-.199 3.665l.008 3.212.083.169c.097.198.298.395.497.487l.14.064 7.23.008 7.229.008.175-.071a.999.999 0 0 0 .597-.629c.064-.173.064-.184.064-3.354 0-2.101-.01-3.181-.03-3.181-.017 0-.03-.021-.03-.046 0-.136-.233-.451-.422-.57-.277-.175.223-.165-7.546-.161-4.21.002-7.167.014-7.239.031M.014 8c0 1.767.004 2.485.009 1.596.004-.888.004-2.334 0-3.212C.018 5.506.014 6.233.014 8m1.997 0v1.996h11.978V6.004H2.011V8M.832 14.02a1.028 1.028 0 0 0-.739.569c-.065.138-.078.208-.078.42 0 .213.013.283.078.421.093.196.287.395.476.488l.136.067 7.256.008 7.255.007.169-.063c.367-.137.645-.56.645-.981 0-.103-.01-.187-.023-.187s-.047-.068-.077-.151c-.073-.207-.32-.451-.55-.544l-.175-.07L8.09 14c-3.913-.003-7.179.006-7.258.02m-.822.989c0 .124.005.175.012.113a1.408 1.408 0 0 0 0-.225c-.007-.062-.012-.011-.012.112" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="category-folder-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M39 17a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4m14.5-8L11 5H2a1 1 0 0 0-1 1v27a2 2 0 0 0 2 2h34a2 2 0 0 0 2-2V10a1 1 0 0 0-1-1H15.5z" stroke="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="phone-icon" viewbox="0 0 16 16">
                                            <svg fill="none" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m9.606 9.333-.04.04-.035.044-.526.66A9.316 9.316 0 0 1 5.94 7.036l.683-.581.037-.032.034-.036a1.68 1.68 0 0 0 .394-1.673l-.002-.009-.003-.008A6.435 6.435 0 0 1 6.76 2.66C6.76 1.748 6.012 1 5.1 1H2.793c-.303 0-.716.063-1.087.311A1.585 1.585 0 0 0 1 2.66C1 9.406 6.601 15 13.34 15a1.59 1.59 0 0 0 1.326-.681c.253-.361.334-.774.334-1.106v-2.3c0-.912-.748-1.66-1.66-1.66-.71 0-1.397-.115-2.039-.322a1.652 1.652 0 0 0-1.695.402z" stroke="var(--icon-fill)" stroke-width="2"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="direction-icon" viewbox="0 0 21 21">
                                            <svg fill="none" height="21" width="21" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m19.71 10.29-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM12 13.5V11H8v3H6v-4c0-.55.45-1 1-1h5V6.5l3.5 3.5-3.5 3.5z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="map-icon" viewbox="0 0 20 19">
                                            <svg fill="none" height="19" width="20" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m19.32 2.05-6-2h-.07a.7.7 0 0 0-.14 0h-.43L7 2 1.32.05a1 1 0 0 0-.9.14A1 1 0 0 0 0 1v14a1 1 0 0 0 .68.95l6 2a1 1 0 0 0 .62 0l5.7-1.9L18.68 18c.106.014.214.014.32 0a.94.94 0 0 0 .58-.19A1.001 1.001 0 0 0 20 17V3a1 1 0 0 0-.68-.95zM6 15.61l-4-1.33V2.39l4 1.33v11.89zm6-1.33-4 1.33V3.72l4-1.33v11.89zm6 1.33-4-1.33V2.39l4 1.33v11.89z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="list-icon" viewbox="0 0 24 24">
                                            <svg fill="none" height="24" width="24" xmlns="http://www.w3.org/2000/svg">
                                                <path clip-rule="evenodd" d="M3 2a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3zm1 18V4h16v16H4zM7 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm1 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm2-8a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-6zm-1 5a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                            </svg>
                                        </symbol>
                                    </svg>
                                    <!-- -->undefined undefined
                                </div>undefined undefined
                            </div>undefinedundefined<div data-v-90c54f5a="">undefined undefined
                                <!-- -->undefined undefined
                            </div>undefinedundefined<div class="cko 📚19-4-0rI2oH cko--close cko--flyover" data-v-90c54f5a="" style='--maker-color-neutral-0: #343b42; --maker-color-neutral-10: #5d6368; --maker-color-neutral-20: #797e83; --maker-color-neutral-80: #9da1a5; --maker-color-neutral-90: #f4f4f5; --maker-color-neutral-100: #ffffff; --maker-color-primary: #212121; --maker-color-background: #343b42; --maker-color-heading: #ffffff; --maker-color-body: #ffffff; --maker-color-elevation: #797e83; --maker-color-overlay: rgba(255, 255, 255, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px;'>undefinedundefined<div class="cko__header">
                                    <div class="cko__header-items cko--max-width">
                                        <div class="cko__header-back">
                                            <button class="cko__back-btn 📚19-4-0_xxoX 📚19-4-0t5BZq" style="--color: #ffffff;" title="Back to Cart" type="button">
                                                <!-- -->
                                                <span class="📚19-4-0qfj5z 📚19-4-0QESOt">
                                                    <span class="icon cko__back-btn-icon 📚19-4-0vCfSe cko__back-btn-icon--medium" data-v-4700918e="" style="--color: currentColor; --icon-size: 16px; --fill: currentColor;">
                                                        <svg fill="none" viewbox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                                            <path clip-rule="evenodd" d="M4.3 7.3a1 1 0 0 0 0 1.4l6 6 1.4-1.4L6.42 8l5.3-5.3-1.42-1.4-6 6Z" fill="currentColor" fill-rule="evenodd"></path>
                                                        </svg>
                                                    </span>
                                                    <span class="cko__back-btn-label display-inline-phone-up">
                                                        <p class="cko__back-btn-label-text 📚19-4-0uGevg 📚19-4-0EEwzY" style='--mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255);'> Back to Cart </p>
                                                    </span>
                                                </span>
                                            </button>
                                        </div>
                                        <div class="cko__header-title">
                                            <img alt="BookTomNYC" height="38" src="https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=400" />
                                        </div>
                                        <div></div>
                                    </div>undefined undefined
                                </div>undefinedundefined<div class="cko__body cko--max-width">
                                    <!-- -->
                                    <svg style="display: none;" xmlns="http://www.w3.org/2000/svg">
                                        <symbol fill="none" id="alert-triangle-icon" viewbox="0 0 16 16">
                                            <path clip-rule="evenodd" d="M.41 13.759 7.561.794a.5.5 0 0 1 .876 0l7.153 12.965a.5.5 0 0 1-.438.741H.847a.5.5 0 0 1-.438-.741zM8 9.002a1 1 0 0 1-1-1v-2a1 1 0 0 1 2 0v2a1 1 0 0 1-1 1zm0 1A1 1 0 1 0 8 12a1 1 0 0 0 0-2z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="email-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm3.5-3h9L8.707 8.793a1 1 0 0 1-1.414 0L3.5 5zM3 6l3.586 3.586a2 2 0 0 0 2.828 0L13 6v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="embed-code-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M0 0h22v12H0z" fill="var(--background-fill)" transform="translate(21 26)"></path>
                                            <path d="m36 38 7-6-7-6M28 26l-7 6 7 6" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                                        </symbol>
                                        <symbol fill="none" id="embed-pdf-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M29.677 32.716s-3.829 10.074-6.974 9.234c-3.145-.84 5.06-5.516 8.752-6.116 3.692-.6 10.939-3.358 10.528 0-.547 3.358-5.743-.6-8.75-4.557-3.009-3.958-4.24-9.834-1.778-9.235 2.46.6-.547 8.155-1.778 10.674z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"></path>
                                        </symbol>
                                        <symbol id="facebook-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8.567 4.437V8.085H9.77l.159-1.5h-1.36l.001-.75c0-.392.037-.602.6-.602h.75v-1.5H8.718c-1.444 0-1.952.728-1.952 1.952v.9h-.9v1.5h.9v4.352h1.801z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="google-plus-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8c0-4.418 3.528-8 7.88-8s7.88 3.582 7.88 8-3.528 8-7.88 8S0 12.418 0 8zm6.438-.229v.869h1.42c-.057.373-.43 1.093-1.42 1.093-.855 0-1.552-.717-1.552-1.6 0-.883.697-1.6 1.552-1.6.487 0 .812.21.998.392l.68-.663A2.385 2.385 0 0 0 6.438 5.6c-1.384 0-2.504 1.133-2.504 2.533s1.12 2.534 2.504 2.534c1.445 0 2.404-1.028 2.404-2.476 0-.166-.018-.293-.04-.42H6.438zm5.365 0h-.715v-.723h-.715v.723h-.716v.724h.716v.724h.715v-.724h.715v-.724z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="instagram-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <g fill-rule="evenodd" style="fill:var(--icon-fill)">
                                                <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-4.267c-1.158 0-1.304.005-1.759.026a3.12 3.12 0 0 0-1.035.198 2.09 2.09 0 0 0-.756.492 2.095 2.095 0 0 0-.493.756c-.106.271-.178.582-.198 1.036-.02.455-.026.6-.026 1.759 0 1.159.005 1.304.026 1.759.021.454.093.764.198 1.035.11.281.255.52.492.756.237.238.476.384.756.493.271.105.582.177 1.036.198.455.02.6.026 1.759.026 1.159 0 1.304-.005 1.759-.026.454-.02.764-.093 1.036-.198.28-.11.518-.255.755-.493.238-.237.383-.475.493-.755.105-.272.177-.582.198-1.036.02-.455.026-.6.026-1.759 0-1.159-.006-1.304-.026-1.76-.021-.453-.093-.764-.198-1.035a2.094 2.094 0 0 0-.493-.756 2.085 2.085 0 0 0-.755-.492c-.272-.105-.583-.177-1.037-.198-.455-.02-.6-.026-1.759-.026H8z"></path>
                                                <path d="M7.618 4.502H8c1.14 0 1.275.004 1.725.025.416.019.641.088.792.147.199.077.34.17.49.319.15.15.242.291.32.49.058.15.127.376.146.792.02.45.025.585.025 1.724s-.004 1.274-.025 1.724c-.019.416-.088.641-.147.792-.077.199-.17.34-.319.49a1.32 1.32 0 0 1-.49.319c-.15.059-.376.128-.792.147-.45.02-.585.025-1.725.025-1.139 0-1.274-.005-1.724-.025-.416-.02-.641-.089-.792-.147-.2-.078-.341-.17-.49-.32a1.322 1.322 0 0 1-.32-.49c-.058-.15-.128-.376-.147-.792-.02-.45-.024-.585-.024-1.724 0-1.14.004-1.274.024-1.724.02-.416.089-.641.147-.792.077-.199.17-.341.32-.49.149-.15.29-.242.49-.32.15-.058.376-.128.792-.147.394-.018.546-.023 1.342-.024v.001zm2.66.709a.512.512 0 1 0 0 1.024.512.512 0 0 0 0-1.024zM8 5.809a2.191 2.191 0 1 0 0 4.382A2.191 2.191 0 0 0 8 5.81z"></path>
                                                <path d="M8 6.578a1.422 1.422 0 1 1 0 2.844 1.422 1.422 0 0 1 0-2.844z"></path>
                                            </g>
                                        </symbol>
                                        <symbol fill="none" id="instagram-item-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M0 0h24v24H0z" fill="var(--background-fill)" transform="translate(20 20)"></path>
                                            <rect height="22" rx="5" stroke="var(--icon-fill)" stroke-width="2" width="22" x="21" y="21"></rect>
                                            <circle cx="32" cy="32" r="5" stroke="var(--icon-fill)" stroke-width="2"></circle>
                                            <circle cx="39" cy="26" fill="var(--icon-fill)" r="1"></circle>
                                        </symbol>
                                        <svg fill="none" height="24" id="tiktok-icon" width="24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 23c6.075 0 11-4.925 11-11S18.075 1 12 1 1 5.925 1 12s4.925 11 11 11z" fill="#fff" style="fill:var(--background-fill)"></path>
                                            <path clip-rule="evenodd" d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12zm1.595-18.996c-.43 0-.86.001-1.292.008a552.03 552.03 0 0 0-.01 4.496 981.783 981.783 0 0 1-.002 3.392c.001.76.002 1.518-.04 2.279-.005.21-.11.396-.211.577l-.024.043c-.335.553-.951.931-1.594.938-.97.087-1.878-.717-2.014-1.675a11.238 11.238 0 0 0-.005-.141c-.01-.27-.019-.545.083-.797.144-.418.42-.777.785-1.02.499-.352 1.166-.404 1.737-.217 0-.37.007-.738.013-1.107.008-.495.016-.99.01-1.484-1.25-.238-2.585.163-3.538 1.004a4.392 4.392 0 0 0-1.487 2.894c-.01.29-.008.58.007.868.12 1.365.937 2.637 2.1 3.332.701.42 1.524.647 2.347.599 1.342-.023 2.648-.752 3.401-1.87a4.48 4.48 0 0 0 .778-2.3 301.8 301.8 0 0 0 .01-3.365l.001-1.74c.3.199.605.393.933.543.753.363 1.587.538 2.417.565V8.477c-.886-.1-1.796-.396-2.44-1.043-.645-.632-.961-1.541-1.007-2.434-.319.003-.638.003-.958.004z" fill="#000" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </svg>
                                        <symbol id="linkedin-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm5.654-1.374H3.84v5.447h1.813V6.626zm.119-1.685C5.76 4.407 5.379 4 4.759 4s-1.026.407-1.026.94c0 .524.394.942 1.002.942h.012c.632 0 1.026-.418 1.026-.941zm6.419 4.009c0-1.673-.895-2.452-2.088-2.452-.962 0-1.393.529-1.634.9v-.772H6.657c.024.511 0 5.447 0 5.447H8.47V9.031c0-.163.012-.325.06-.442.131-.325.43-.662.93-.662.656 0 .919.5.919 1.232v2.914h1.813V8.95z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="twitter-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.76-1.497.017.276-.28-.034c-1.018-.13-1.908-.57-2.663-1.31l-.37-.367-.095.27c-.201.605-.072 1.244.347 1.673.224.237.174.271-.212.13-.135-.045-.252-.08-.263-.062-.04.04.095.553.201.757.146.282.442.559.767.723l.274.13-.325.005c-.313 0-.324.006-.29.125.111.367.553.757 1.046.926l.347.119-.302.18a3.15 3.15 0 0 1-1.5.419c-.252.005-.459.028-.459.045 0 .056.683.373 1.08.497 1.192.367 2.608.21 3.67-.418.756-.446 1.512-1.333 1.864-2.192.19-.458.38-1.294.38-1.695 0-.26.018-.294.33-.604.186-.181.36-.379.393-.435.056-.108.05-.108-.235-.012-.476.17-.543.147-.308-.107.173-.18.38-.508.38-.604 0-.017-.084.01-.179.062-.1.056-.324.141-.492.192l-.302.096-.274-.187a2.278 2.278 0 0 0-.476-.248 1.909 1.909 0 0 0-.98.022c-.699.255-1.141.91-1.09 1.628z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="vimeo-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm12.529-1.546c.057-1.25-.409-1.89-1.395-1.919-1.33-.043-2.232.708-2.704 2.253a1.8 1.8 0 0 1 .71-.158c.49 0 .705.275.647.823-.029.331-.244.814-.646 1.449-.403.635-.705.952-.905.952-.259 0-.496-.489-.712-1.467-.072-.287-.201-1.02-.388-2.2-.172-1.093-.632-1.604-1.38-1.532-.315.03-.79.316-1.422.862-.46.417-.927.833-1.4 1.25l.45.581c.431-.3.682-.452.754-.452.33 0 .638.517.925 1.55l.775 2.84c.387 1.034.86 1.55 1.42 1.55.903 0 2.008-.848 3.313-2.544 1.262-1.624 1.915-2.904 1.958-3.838z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="video-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M28 40V25l11 7.5L28 40z" fill="var(--icon-fill)" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                                        </symbol>
                                        <symbol id="youtube-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8c0-4.418 3.528-8 7.88-8s7.88 3.582 7.88 8-3.528 8-7.88 8S0 12.418 0 8zm11.982-1.61s-.082-.601-.334-.866c-.32-.347-.677-.349-.84-.369-1.175-.088-2.937-.088-2.937-.088h-.004s-1.762 0-2.936.088c-.165.02-.522.022-.842.37-.251.264-.333.865-.333.865s-.084.705-.084 1.411v.662c0 .705.084 1.411.084 1.411s.082.6.333.865c.32.348.74.337.926.373.672.067 2.854.088 2.854.088s1.764-.003 2.938-.091c.164-.02.522-.022.841-.37.252-.264.334-.865.334-.865s.084-.706.084-1.411V7.8c0-.706-.084-1.411-.084-1.411zm-4.98 2.874v-2.45l2.268 1.23-2.268 1.22z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="pinterest-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm-2.63-1.07h.47c.3-.49.74-1.28.9-1.9l.46-1.73c.23.45.92.83 1.66.83 2.18 0 3.76-2 3.76-4.5 0-2.4-1.95-4.2-4.47-4.2-3.13 0-4.79 2.1-4.79 4.4 0 1.06.57 2.38 1.47 2.8.14.07.21.04.24-.1l.2-.81a.22.22 0 0 0-.04-.21 2.82 2.82 0 0 1-.54-1.66c0-1.6 1.2-3.14 3.27-3.14 1.78 0 3.03 1.2 3.03 2.95 0 1.96-1 3.32-2.28 3.32-.71 0-1.25-.6-1.08-1.31.21-.87.6-1.8.6-2.42 0-.56-.3-1.02-.91-1.02-.73 0-1.31.75-1.31 1.76 0 .64.21 1.08.21 1.08l-.85 3.6a8.15 8.15 0 0 0 0 2.26z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="snapchat-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8c0-4.42 3.53-8 7.88-8a7.94 7.94 0 0 1 7.88 8c0 4.42-3.53 8-7.88 8A7.94 7.94 0 0 1 0 8zm7.95-4h-.17c-.18 0-.55.03-.96.2A2.14 2.14 0 0 0 5.7 5.37c-.19.43-.14 1.15-.1 1.73v.19a.32.32 0 0 1-.13.02.9.9 0 0 1-.38-.1.33.33 0 0 0-.14-.03.5.5 0 0 0-.25.07.35.35 0 0 0-.18.23c0 .06 0 .18.12.3a.9.9 0 0 0 .31.18l.13.05c.15.05.39.12.45.27.03.07.02.17-.04.29a2.82 2.82 0 0 1-.94 1.13c-.22.15-.46.24-.71.28a.2.2 0 0 0-.17.21l.02.09c.04.1.14.17.29.25.18.08.46.16.82.21l.05.19.05.2c.02.07.08.16.22.16.06 0 .12 0 .2-.02a2.15 2.15 0 0 1 .75-.03c.2.04.38.16.59.31a1.89 1.89 0 0 0 1.26.46c.52 0 .86-.24 1.16-.46.2-.15.38-.27.59-.3a1.9 1.9 0 0 1 .75.01l.2.03c.11 0 .2-.06.22-.17l.05-.2.05-.18c.36-.05.64-.13.82-.21.15-.08.24-.16.28-.25a.26.26 0 0 0 .03-.09.2.2 0 0 0-.17-.2c-1.12-.2-1.63-1.36-1.65-1.41v-.01c-.06-.12-.07-.22-.04-.3.06-.14.3-.21.45-.26l.12-.05a.94.94 0 0 0 .34-.2c.08-.09.1-.18.1-.23 0-.14-.1-.26-.27-.32a.48.48 0 0 0-.18-.03.4.4 0 0 0-.17.03.95.95 0 0 1-.35.1.31.31 0 0 1-.12-.02l.01-.17V7.1a4.3 4.3 0 0 0-.1-1.73 2.2 2.2 0 0 0-.52-.74 2.2 2.2 0 0 0-1.57-.62z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="yelp-icon" viewbox="0 0 22 23">
                                            <path clip-rule="evenodd" d="M11 .876c-6.001 0-11 4.999-11 11 0 6.002 4.999 11 11 11s11-4.998 11-11c0-6.001-4.999-11-11-11z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                            <path clip-rule="evenodd" d="M10.636 4.94a6.049 6.049 0 0 0-2.505.737c-.397.215-.444.455-.208.853.82 1.38 1.64 2.76 2.465 4.138.086.144.19.284.31.395.298.275.675.157.78-.245.033-.13.042-.268.05-.387l.01-.133-.09-1.421c-.071-1.137-.142-2.254-.215-3.37-.029-.443-.177-.593-.597-.566zm2.35 7.374a.766.766 0 0 0 .107-.018l.554-.146c.681-.18 1.362-.36 2.042-.546.38-.103.502-.332.364-.724a4.9 4.9 0 0 0-1.185-1.881c-.287-.283-.54-.251-.771.08-.36.51-.716 1.025-1.072 1.54-.18.261-.36.522-.542.783a.54.54 0 0 0-.039.587c.103.204.264.323.5.33l.042-.005zm-2.88-.142c.257.112.37.305.36.587-.012.267-.136.436-.403.526l-.215.073c-.785.266-1.57.532-2.356.79-.342.112-.557-.011-.634-.386-.089-.757-.035-1.824.054-2.242.098-.462.34-.577.752-.402.816.348 1.63.7 2.443 1.054zm5.752 2.243-.562-.2c-.697-.247-1.394-.495-2.092-.74-.215-.076-.402-.008-.545.175-.15.191-.216.414-.087.638.501.87 1.009 1.736 1.522 2.598.124.209.321.254.534.146a1.11 1.11 0 0 0 .253-.177 5.28 5.28 0 0 0 1.18-1.602c.039-.082.064-.171.09-.26l.036-.123c-.012-.242-.127-.383-.329-.454zm-4.691-.313c.223.094.326.258.327.538.002.338.002.677.001 1.016v.43h-.015v.436c.001.337.002.674-.002 1.011-.003.366-.18.561-.521.525a4.275 4.275 0 0 1-2.095-.815c-.285-.208-.308-.475-.087-.758.584-.748 1.174-1.49 1.766-2.23.166-.208.387-.254.626-.153z" fill-rule="evenodd" style="fill:var(--background-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="cash-app-logo-icon" viewbox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C20 4.56 20 6.24 20 9.6v.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C15.44 20 13.76 20 10.4 20h-.8c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 15.44 0 13.76 0 10.4v-.8z" fill="var(--color-cash-app)"></path>
                                            <path clip-rule="evenodd" d="M10.52 6.853c1.036 0 2.029.42 2.678.995.164.146.41.145.564-.01l.772-.784a.403.403 0 0 0-.02-.587 6.105 6.105 0 0 0-2.07-1.164l.243-1.153a.405.405 0 0 0-.396-.488H10.8a.405.405 0 0 0-.396.32l-.218 1.026c-1.983.1-3.665 1.089-3.665 3.12 0 1.758 1.391 2.511 2.86 3.033 1.39.521 2.124.715 2.124 1.449 0 .753-.733 1.197-1.816 1.197-.986 0-2.02-.325-2.821-1.116a.403.403 0 0 0-.566-.001l-.83.818a.407.407 0 0 0 .002.582c.647.628 1.467 1.082 2.401 1.337l-.227 1.068a.405.405 0 0 0 .393.49l1.494.01a.404.404 0 0 0 .399-.321l.216-1.027c2.375-.147 3.828-1.438 3.828-3.327 0-1.739-1.448-2.473-3.207-3.072-1.004-.367-1.874-.618-1.874-1.371 0-.734.812-1.024 1.623-1.024z" fill="#fff" fill-rule="evenodd"></path>
                                        </symbol>
                                        <symbol fill="none" id="square-pay-logo-icon" viewbox="0 0 52 19" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="19" width="52" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M14.159 0H2.84A2.84 2.84 0 0 0 0 2.84v11.318A2.842 2.842 0 0 0 2.841 17H14.16A2.842 2.842 0 0 0 17 14.158V2.84A2.84 2.84 0 0 0 14.159 0zm-.25 13.013a.896.896 0 0 1-.896.896H3.989a.897.897 0 0 1-.896-.896V3.988a.896.896 0 0 1 .896-.897h9.024a.897.897 0 0 1 .896.897v9.025z" fill="var(--icon-fill)"></path>
                                                <path d="M6.694 10.806a.514.514 0 0 1-.514-.516V6.687a.514.514 0 0 1 .514-.517h3.612a.515.515 0 0 1 .514.517v3.603a.516.516 0 0 1-.514.516H6.694z" fill="var(--icon-fill)"></path>
                                                <path d="M23.744 15.5v-4.716h2.178c2.934 0 4.59-1.35 4.59-3.942S28.856 2.9 25.922 2.9h-4.626v12.6h2.448zm0-10.548h2.25c1.26 0 2.088.648 2.088 1.89s-.828 1.89-2.088 1.89h-2.25v-3.78zM34.865 15.68c1.386 0 2.286-.648 2.736-1.728h.145V15.5h2.213V8.804c0-1.944-1.404-2.988-3.96-2.988-2.088 0-3.672 1.116-3.924 2.916h2.268c.162-.738.792-1.152 1.656-1.152.99 0 1.602.54 1.602 1.386v.846l-2.231.162c-2.197.162-3.492 1.152-3.492 2.952 0 1.62 1.206 2.754 2.987 2.754zm.756-1.728c-.846 0-1.35-.504-1.35-1.206 0-.72.505-1.206 1.512-1.278l1.819-.144v.396c0 1.332-.792 2.232-1.98 2.232zm8.382 4.932c1.764 0 2.754-.612 3.402-2.448l3.618-10.44h-2.232l-1.8 5.472-.342 1.332h-.144l-.324-1.332-1.836-5.472h-2.358l3.528 9.612-.18.504c-.234.594-.612.828-1.386.828h-1.332v1.944h1.386z" fill="var(--icon-fill)" fill-opacity=".95"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="close-icon" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <rect height="20.587" rx=".936" style="fill:var(--icon-fill)" transform="scale(.99243 1.00751) rotate(45 4.622 24.714)" width="1.872"></rect>
                                            <rect height="20.587" rx=".936" style="fill:var(--icon-fill)" transform="matrix(-.70176 .71242 .70176 .71242 5.313 4)" width="1.872"></rect>
                                        </symbol>
                                        <symbol fill="none" id="shopping-bag-icon" viewbox="0 0 33 33">
                                            <circle cx="16.5" cy="16.5" fill="var(--background-fill)" fill-opacity=".4" r="16.5"></circle>
                                            <path clip-rule="evenodd" d="M14.836 15a1 1 0 0 1-2 0h1-1v-.026l.001-.065a24.537 24.537 0 0 1 .054-1.273h-2.143L10 23.134h12.673l-.748-9.498h-2.143a29.311 29.311 0 0 1 .05 1.038l.004.236V14.998l-1 .001h1a1 1 0 0 1-2 0v-.067l-.004-.208a22.363 22.363 0 0 0-.055-1.089h-2.881a23.613 23.613 0 0 0-.059 1.297V15zm.305-3.364h2.391c-.15-.823-.359-1.56-.632-2.07-.287-.537-.493-.566-.563-.566-.071 0-.277.03-.564.566-.273.51-.483 1.246-.632 2.07zm4.42 0h2.364a2 2 0 0 1 1.994 1.843l.748 9.498a2 2 0 0 1-1.994 2.157H10a2 2 0 0 1-1.994-2.157l.748-9.498a2 2 0 0 1 1.994-1.843h2.364c.016-.103.034-.207.053-.312.162-.91.419-1.908.845-2.702C14.425 7.846 15.157 7 16.337 7c1.179 0 1.91.846 2.326 1.622.426.794.683 1.792.845 2.702.019.104.037.209.053.312z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                        </symbol>
                                        <symbol fill="none" id="ellipse-icon" viewbox="0 0 4 4" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="4" width="4" xmlns="http://www.w3.org/2000/svg">
                                                <circle cx="2" cy="2" fill="var(--icon-fill)" r="2"></circle>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="tag-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path clip-rule="evenodd" d="M15.707 5.107c.777-.776 2.05-1.564 3.488-2.158C20.63 2.356 22.122 2 23.3 2H34c2.188 0 4 1.691 4 3.9v10.7c0 1.166-.374 2.625-.992 4.052-.615 1.418-1.429 2.707-2.226 3.552l-8.05 8.114L7.615 13.2l8.092-8.093zM6.2 14.614l19.124 19.123-3.131 3.156-.001.001a3.889 3.889 0 0 1-5.485-.001l-.005-.006-.025-.025-.099-.1-.374-.377-1.352-1.363-4.23-4.264a4953.029 4953.029 0 0 0-7.515-7.565 3.889 3.889 0 0 1 0-5.486L6.2 14.614zm9.09 23.69L16 37.6l-.71.704-.002-.002-.007-.007-.025-.025-.098-.099-.374-.378-1.352-1.362-4.23-4.264a4998 4998 0 0 0-7.509-7.56 5.889 5.889 0 0 1 0-8.314l12.6-12.6c1.023-1.024 2.55-1.936 4.138-2.592C20.019.444 21.778 0 23.3 0H34c3.211 0 6 2.509 6 5.9v10.7c0 1.534-.477 3.275-1.158 4.848-.684 1.577-1.617 3.084-2.617 4.14l-.016.016-12.6 12.7-.003.003a5.889 5.889 0 0 1-8.314 0l-.003-.003zM35 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="digital-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M35 8h.974a.974.974 0 0 0-.285-.689l-.69.689zm-7-7 .689-.689a.974.974 0 0 0-.69-.285V1zm6 33.026H10v1.948h24v-1.948zm-24 0c-.042 0-.06-.007-.06-.007s.003 0 .008.004a.1.1 0 0 1 .03.03l.003.007s-.007-.018-.007-.06H8.026c0 .521.178 1.032.56 1.414.382.382.893.56 1.414.56v-1.948zM9.974 34V2H8.026v32h1.948zm0-32 .001-.011c-.001.003-.001.002.002-.002a.058.058 0 0 1 .018-.01c.007-.003.01-.003.005-.003V.026C9.026.026 8.026.8 8.026 2h1.948zm24.051 32v.011c0-.003.001-.002-.002.002a.06.06 0 0 1-.018.01c-.007.003-.01.003-.005.003v1.948c.974 0 1.974-.774 1.974-1.974h-1.949zm1.95 0V8h-1.95v26h1.95zm-.286-26.689-7-7-1.378 1.378 7 7 1.378-1.378zM27.999.026H10v1.948h18V.026z" fill="var(--icon-fill)"></path>
                                                <path d="M28 1v7h7" stroke="var(--icon-fill)" stroke-linejoin="round" stroke-width="1.949"></path>
                                                <path d="M31 37.998h.974a.974.974 0 0 1-.069.36l-.905-.36zM8.5 3.924a.974.974 0 1 1 0 1.949V3.924zM6 5.873a.18.18 0 0 0-.058.007l.007-.005a.1.1 0 0 0 .03-.029l.003-.006s-.007.02-.007.061h-1.95c0-.521.178-1.032.56-1.415.382-.383.893-.562 1.415-.562v1.949zm-.025.028v32.097h-1.95V5.901h1.95zm0 32.097v.012c0 .001 0 .001 0 0l.004.004a.06.06 0 0 0 .017.01c.007.003.009.003.004.003v1.948c-.976 0-1.974-.778-1.974-1.977h1.949zm.025.029h24v1.948H6v-1.948zm24 0c-.132 0-.2.056-.186.046a.657.657 0 0 0 .112-.131 1.808 1.808 0 0 0 .17-.31c.001 0 .001 0 0 0v.004c-.001 0-.001.001.904.362l.905.361v.002l-.002.002a.374.374 0 0 1-.002.006l-.007.017a2.646 2.646 0 0 1-.094.203 3.73 3.73 0 0 1-.276.468 2.54 2.54 0 0 1-.52.559 1.64 1.64 0 0 1-1.004.36v-1.95zm1-.029h-.974v-3.009h1.948v3.009H31zM6 3.924h2.5v1.949H6V3.924z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="service-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m15 8 .74.673a1 1 0 0 0-.033-1.38L15 8zM5 19l-.707.707a1 1 0 0 0 1.447-.034L5 19zm-3-3-.74-.673a1 1 0 0 0 .033 1.38L2 16zM12 5l.707-.707a1 1 0 0 0-1.447.034L12 5zm13 3-.707-.707a1 1 0 0 0-.033 1.38L25 8zm10 11-.74.673a1 1 0 0 0 1.447.034L35 19zm3-3 .707.707a1 1 0 0 0 .033-1.38L38 16zM28 5l.74-.673a1 1 0 0 0-1.447-.034L28 5zM9 28.9l-.707.707.049.046L9 28.9zm0-2.8-.707-.707L9 26.1zm3.5-3.5.707.707-.707-.707zm4.9 11.9-.707-.707a.994.994 0 0 0-.046.049l.753.658zm11.8-5.6.707-.707a1.075 1.075 0 0 0-.026-.026l-.68.733zM32 26l.753-.659a.994.994 0 0 0-.046-.048L32 26zm-1.793-3.207a1 1 0 0 0-1.414 1.414l1.414-1.414zm-3.1 8.2a1 1 0 0 0-1.414 1.414l1.415-1.414zm1.374-4.126a1 1 0 0 0-1.361 1.466l1.36-1.466zm-6.774 4.426a1 1 0 0 0-1.414 1.414l1.414-1.414zM26 34.7l-.573-.82a.995.995 0 0 0-.027.02l.6.8zm.3-3-.733.68.026.027.707-.707zm-.567-2.08a1 1 0 0 0-1.466 1.36l1.466-1.36zM6.707 17.293a1 1 0 0 0-1.414 1.414l1.414-1.414zm3.586 6.414a1 1 0 0 0 1.414-1.414l-1.414 1.414zM19 16l-.287-.958a.507.507 0 0 0-.018.006L19 16zm4 1 .707-.707a1.011 1.011 0 0 0-.082-.074L23 17zm-8.74-9.673-10 11 1.48 1.346 10-11-1.48-1.346zM5.707 18.293l-3-3-1.414 1.414 3 3 1.414-1.414zm-2.967-1.62 10-11-1.48-1.346-10 11 1.48 1.346zm8.553-10.966 3 3 1.414-1.414-3-3-1.414 1.414zM24.26 8.673l10 11 1.48-1.346-10-11-1.48 1.346zm11.447 11.034 3-3-1.414-1.414-3 3 1.414 1.414zm3.033-4.38-10-11-1.48 1.346 10 11 1.48-1.346zM27.293 4.293l-3 3 1.414 1.414 3-3-1.414-1.414zm-17.585 23.9c-.41-.41-.41-.976 0-1.386l-1.415-1.414c-1.19 1.19-1.19 3.024 0 4.214l1.415-1.414zm0-1.386 3.5-3.5-1.415-1.414-3.5 3.5 1.415 1.414zm3.5-3.5c.409-.41.976-.41 1.385 0l1.415-1.414c-1.191-1.19-3.024-1.19-4.215 0l1.415 1.414zm1.385 0c.41.41.41.976 0 1.386l1.415 1.414c1.19-1.19 1.19-3.024 0-4.214l-1.415 1.414zm0 1.386-3.5 3.5 1.415 1.414 3.5-3.5-1.415-1.414zm-3.451 3.454a1.13 1.13 0 0 1-1.483 0l-1.317 1.506a3.13 3.13 0 0 0 4.117 0l-1.317-1.506zm1.365 2.846c-.409-.41-.41-.976 0-1.386l-1.414-1.414c-1.19 1.19-1.19 3.023 0 4.214l1.414-1.414zm3.5-4.886c.41-.41.977-.41 1.386 0l1.414-1.414c-1.19-1.19-3.023-1.19-4.214 0l1.415 1.414zm1.386 0c.41.41.41.977 0 1.386l1.414 1.414c1.19-1.19 1.19-3.023 0-4.214l-1.414 1.414zm0 1.386-3.5 3.5 1.414 1.414 3.5-3.5-1.414-1.414zm-3.545 3.549c-.277.316-.903.388-1.34-.05l-1.415 1.415c1.162 1.163 3.137 1.235 4.26-.048l-1.505-1.318zm1.46 2.751c-.41-.41-.41-.976 0-1.386l-1.415-1.414c-1.19 1.19-1.19 3.024 0 4.214l1.414-1.414zm3.5-4.886c.409-.41.975-.41 1.385 0l1.414-1.414c-1.19-1.19-3.023-1.19-4.214 0l1.414 1.414zm1.385 0c.41.41.41.977 0 1.386l1.414 1.414c1.19-1.19 1.19-3.024 0-4.214l-1.414 1.414zm0 1.386-3.5 3.5 1.414 1.414 3.5-3.5-1.414-1.414zm-3.546 3.549c-.277.316-.902.389-1.34-.049l-1.414 1.414c1.162 1.163 3.137 1.235 4.26-.048l-1.506-1.317zm11.846-4.235c1.19 1.19 3.024 1.19 4.214 0l-1.414-1.414c-.41.41-.976.41-1.386 0l-1.414 1.414zm4.214 0c1.374-1.373.99-3.187.046-4.265l-1.505 1.317c.456.52.472 1.107.045 1.534l1.414 1.414zm0-4.314-2.5-2.5-1.414 1.414 2.5 2.5 1.414-1.414zm-7.014 7.114c1.19 1.19 3.024 1.19 4.214 0l-1.414-1.414c-.41.41-.976.41-1.385 0l-1.415 1.414zm4.214 0c1.191-1.19 1.19-3.024 0-4.214l-1.414 1.414c.41.41.41.977 0 1.386l1.415 1.414zm-.026-4.24-1.4-1.3-1.361 1.466 1.4 1.3 1.36-1.466zm-9.588 4.54 2.4 2.4 1.414-1.414-2.4-2.4-1.414 1.414zm2.4 2.4c.97.97 2.623 1.356 3.907.393l-1.2-1.6c-.316.237-.863.223-1.293-.207l-1.414 1.414zm3.88.412c1.508-1.055 1.676-3.284.434-4.526l-1.414 1.414c.358.359.326 1.129-.166 1.474l1.146 1.638zm.46-4.5-1.3-1.4-1.466 1.361 1.3 1.4 1.466-1.36zM5.293 18.708l5 5 1.414-1.414-5-5-1.414 1.414zM26 9l-.707-.707h-.001v.001h-.001v.001l-.001.001-.001.001h-.001v.001l-.001.001h-.001V8.3l-.002.001v.001h-.001l-.001.002-.002.002-.002.002-.002.002h-.001a.13.13 0 0 0-.006.007l-.002.001v.002l-.002.001-.002.002a.103.103 0 0 0-.004.004l-.002.002-.001.001-.002.002-.002.001-.001.002-.002.002-.002.002-.002.001c0 .001 0 .002-.002.002l-.001.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.003.002-.002.003-.002.002-.002.002-.003.002-.002.003-.002.002-.002.002a.272.272 0 0 0-.005.005l-.003.003-.002.002-.003.003-.002.002-.003.003-.002.002-.003.003-.003.003-.003.002-.002.003-.003.003-.003.002-.003.003-.002.003-.003.003a.072.072 0 0 0-.003.003l-.003.003a.073.073 0 0 0-.003.003l-.003.003-.003.003a.853.853 0 0 0-.003.003l-.003.003-.003.003a.1.1 0 0 1-.003.003l-.003.003-.003.003-.003.003-.003.003a.493.493 0 0 0-.007.007l-.003.003a.108.108 0 0 1-.007.007l-.003.003a1956203611.42 1956203611.42 0 0 0-.007.007l-.003.003-.004.004-.003.003-.004.003c0 .002-.002.003-.003.004l-.004.004a1.197 1.197 0 0 0-.003.003l-.004.004-.003.003-.004.004-.004.003c0 .002-.002.003-.003.004a.117.117 0 0 0-.008.008l-.004.003-.003.004-.004.004-.004.004-.004.003c0 .002-.002.003-.003.004a1.407 1.407 0 0 0-.004.004l-.004.004a.717.717 0 0 0-.004.004l-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004a.152.152 0 0 1-.008.008l-.004.004-.004.004-.004.004-.004.004a.16.16 0 0 0-.005.004c0 .002-.002.003-.004.005l-.004.004-.004.004-.004.004-.005.004-.004.005-.004.004a.175.175 0 0 1-.005.004c0 .002-.002.003-.004.005l-.004.004-.005.004c0 .002-.002.003-.004.005l-.004.004-.005.004-.004.005a.167.167 0 0 0-.004.004l-.005.005-.005.004-.004.005a1.916 1.916 0 0 0-.005.004l-.004.005-.005.004-.004.005-.005.004-.004.005-.005.005-.005.004-.004.005-.005.005-.004.004a.173.173 0 0 0-.005.005l-.005.005a.208.208 0 0 0-.01.009c0 .002-.002.003-.004.005a.21.21 0 0 0-.005.005l-.005.004-.004.005-.005.005-.005.005-.005.005-.005.004a.225.225 0 0 0-.004.005l-.005.005a.205.205 0 0 0-.005.005l-.005.005-.005.005-.005.005-.005.005-.005.004-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005a2.416 2.416 0 0 0-.005.005l-.005.006a1.215 1.215 0 0 0-.005.005l-.005.005a2.445 2.445 0 0 0-.01.01l-.005.005a2.467 2.467 0 0 0-.005.005l-.005.005-.006.005-.005.005-.005.006-.005.005-.005.005-.005.005-.006.005-.005.006-.005.005-.005.005a.233.233 0 0 0-.005.005l-.006.005-.005.006-.005.005-.005.005-.006.005a.294.294 0 0 1-.005.006l-.005.005a.265.265 0 0 0-.021.021l-.006.006-.005.005a.265.265 0 0 1-.01.01l-.006.006a.266.266 0 0 1-.016.016l-.006.005a.242.242 0 0 0-.005.006l-.005.005-.006.005-.005.006a2.742 2.742 0 0 0-.016.016l-.005.005-.006.006-.005.005-.006.006-.005.005a2.765 2.765 0 0 1-.006.005l-.005.006-.005.005a.283.283 0 0 0-.006.006l-.005.005-.006.006-.005.005-.006.005-.005.006-.005.005-.006.006a.284.284 0 0 0-.005.005l-.006.006a.284.284 0 0 0-.005.005l-.006.006-.005.005a.284.284 0 0 1-.011.01l-.006.006-.005.006-.005.005-.006.006a2.803 2.803 0 0 1-.005.005l-.006.006-.005.005-.006.006-.005.005-.006.006a.284.284 0 0 0-.01.01l-.006.006-.006.005-.005.006-.006.005-.005.006-.005.005a.284.284 0 0 1-.006.006l-.005.005-.006.006-.005.005a.284.284 0 0 1-.006.005l-.005.006a.284.284 0 0 1-.006.005l-.005.006-.005.005-.006.006-.005.005-.006.006a.283.283 0 0 1-.005.005l-.006.005a2.765 2.765 0 0 1-.005.006l-.005.005-.006.006a2.757 2.757 0 0 1-.005.005l-.006.005-.005.006-.005.005-.006.006-.005.005-.006.005-.005.006-.005.005a.267.267 0 0 1-.006.006l-.005.005a.266.266 0 0 0-.005.005l-.006.006a.242.242 0 0 0-.005.005l-.006.005-.005.006a2.696 2.696 0 0 1-.005.005l-.005.005-.006.006-.005.005-.005.005-.006.006-.005.005-.005.005a.264.264 0 0 1-.006.005l-.005.006-.005.005a.24.24 0 0 1-.005.005l-.006.005-.005.006-.005.005-.005.005-.006.005-.005.006-.005.005-.005.005-.005.005a.231.231 0 0 1-.005.005l-.006.005-.005.006-.005.005a.253.253 0 0 1-.005.005l-.005.005-.005.005-.005.005-.006.005a2.445 2.445 0 0 1-.005.005l-.005.005-.005.006-.005.005-.005.005a2.402 2.402 0 0 1-.015.015l-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.004-.005.005-.005.005-.004.005-.005.005-.005.005a.205.205 0 0 1-.01.01l-.005.004a2.179 2.179 0 0 1-.014.015l-.005.005-.005.004-.004.005-.005.005a2.119 2.119 0 0 1-.01.01l-.004.004-.005.005-.005.004-.004.005-.005.005-.004.004a.181.181 0 0 1-.01.01l-.004.004a.18.18 0 0 1-.005.004l-.004.005a1.922 1.922 0 0 1-.005.005l-.004.004-.005.004-.004.005-.005.004-.004.005a.183.183 0 0 1-.005.004c0 .002-.002.003-.004.005a.182.182 0 0 1-.004.004l-.005.004-.004.005-.004.004-.005.004-.004.005-.004.004-.005.004c0 .002-.002.003-.004.004l-.004.005-.004.004-.004.004-.005.004c0 .002-.002.003-.004.004l-.004.005-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004a8491334680.957 8491334680.957 0 0 1-.008.008l-.004.004-.004.004-.004.004-.004.003c0 .002-.002.003-.003.004l-.004.004-.004.004-.004.004-.004.003c0 .002-.002.003-.003.004l-.004.004a3633073655.432 3633073655.432 0 0 0-.008.007c0 .002-.002.003-.003.004l-.004.004-.003.003-.004.004-.004.003-.003.004-.003.003-.004.004-.003.003-.004.004a3250884297.246 3250884297.246 0 0 0-.01.01l-.003.003-.004.004-.003.003-.003.003-.004.003a2716058231.859 2716058231.859 0 0 1-.006.007l-.003.003-.003.003-.003.003-.004.003-.003.004-.003.003-.003.003-.003.003-.003.002c0 .002-.002.002-.003.003l-.003.003-.002.003-.003.003-.003.003-.003.003-.003.003-.003.002-.002.003-.003.003-.003.002-.002.003-.003.003-.002.002-.003.003-.003.002-.002.003-.003.002-.002.003-.002.002-.003.002-.002.003-.002.002-.003.002-.002.003-.002.002-.002.002-.003.002-.002.003-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.001.001-.002.002-.002.002 1.414 1.414.002-.002.002-.002.002-.001.001-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.003-.002.002-.003.002-.002.002-.002.002-.002.003-.003.002-.002.003-.002.002-.003.002-.002.003-.002.002-.003.003-.003.002-.002.003-.003.002-.002.003-.003.003-.002.002-.003.003-.003.003-.002a.037.037 0 0 0 .003-.003l.002-.003.003-.003.003-.003.003-.003.003-.002a.08.08 0 0 1 .003-.003l.003-.003.003-.003.003-.003.003-.003a.09.09 0 0 1 .006-.006l.003-.004.003-.003a.092.092 0 0 1 .003-.003l.003-.003.003-.003.004-.003c0-.002.002-.003.003-.004l.003-.003.003-.003a2889930025.631 2889930025.631 0 0 1 .007-.007l.003-.003a.055.055 0 0 1 .004-.004l.003-.003.004-.003c0-.002.002-.003.003-.004l.004-.003c0-.002.002-.003.003-.004l.004-.004a3439172743.957 3439172743.957 0 0 0 .007-.007l.003-.003.004-.004.004-.003.003-.004.004-.004.004-.004a.13.13 0 0 1 .004-.003c0-.002.002-.003.003-.004l.004-.004.004-.004.004-.004.004-.003c0-.002.002-.003.004-.004 0-.002.002-.003.003-.004a.149.149 0 0 1 .008-.008l.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.005-.004c0-.002.002-.003.004-.004l.004-.005.004-.004.004-.004.004-.004.005-.004a.172.172 0 0 1 .008-.009l.004-.004.005-.004.004-.005.004-.004.005-.004a.18.18 0 0 1 .004-.005l.004-.004.005-.005.004-.004.005-.004.004-.005.005-.004.004-.005.004-.004.005-.005a.197.197 0 0 1 .005-.004l.004-.005.005-.005a.197.197 0 0 1 .013-.013l.005-.005a3743849765.858 3743849765.858 0 0 0 .01-.01l.004-.004a.104.104 0 0 1 .01-.01l.004-.004.005-.005.005-.004.004-.005.005-.005.005-.005.005-.005.005-.004.004-.005.005-.005.005-.005.005-.005.005-.005.005-.005a.229.229 0 0 1 .01-.01l.005-.004.004-.005.005-.005a.233.233 0 0 1 .005-.005l.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005a.118.118 0 0 0 .005-.005l.006-.005.005-.005.005-.005.005-.005.005-.006.005-.005.005-.005a.253.253 0 0 1 .005-.005l.005-.005.005-.005.006-.005a.253.253 0 0 1 .005-.006l.005-.005.005-.005.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006.005-.005.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006a.267.267 0 0 1 .005-.005l.006-.005a.267.267 0 0 1 .005-.006l.005-.005a.267.267 0 0 1 .006-.005l.005-.006.006-.005.005-.006a.267.267 0 0 1 .005-.005l.006-.005.005-.006.005-.005.006-.006.005-.005.006-.005.005-.006.005-.005.006-.006.005-.005.006-.005.005-.006.006-.005.005-.006.005-.005a.143.143 0 0 0 .006-.006l.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006.005-.005.006-.006.005-.005.006-.006.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006.006-.005a.283.283 0 0 1 .005-.006l.005-.005.006-.006.005-.005a.283.283 0 0 1 .006-.006l.005-.005a.143.143 0 0 0 .006-.006l.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006.006-.005.005-.006.006-.005a.283.283 0 0 1 .005-.006l.005-.005.006-.006.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006a.143.143 0 0 0 .006-.005l.005-.006.005-.005.006-.006.005-.005.006-.005.005-.006a.283.283 0 0 1 .006-.005l.005-.006.005-.005.006-.005.005-.006.006-.005.005-.006.005-.005.006-.005.005-.006.005-.005.006-.005.005-.006.006-.005a.267.267 0 0 1 .005-.006l.005-.005.005-.005.006-.006.005-.005a.267.267 0 0 1 .01-.01l.006-.006.005-.005.006-.005a.262.262 0 0 1 .01-.011l.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005a.253.253 0 0 1 .005-.005l.006-.005a.253.253 0 0 1 .005-.005l.005-.006.005-.005a.253.253 0 0 1 .005-.005l.005-.005.005-.005.005-.005.005-.005.006-.005a.238.238 0 0 1 .005-.005l.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.004-.005.005-.005.005-.005.005-.005.005-.005a.224.224 0 0 1 .005-.005l.005-.005.005-.004.004-.005.005-.005.005-.005.005-.005.005-.004.004-.005a.21.21 0 0 1 .01-.01l.004-.004.005-.005.005-.005a.206.206 0 0 1 .004-.004l.005-.005.005-.004.004-.005.005-.005.004-.004.005-.005.005-.004.004-.005.005-.004.004-.005.005-.005.004-.004.005-.005.004-.004.005-.004.004-.005.004-.004.005-.005.004-.004.004-.004.005-.005.004-.004.004-.004.005-.004.004-.005.004-.004.004-.004.005-.004c0-.002.002-.003.004-.004l.004-.005.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004a.153.153 0 0 1 .004-.004l.004-.004a.149.149 0 0 1 .008-.008.136.136 0 0 1 .008-.008 8072996200.381 8072996200.381 0 0 0 .008-.008l.004-.004.004-.003c0-.002.002-.003.004-.004 0-.002.002-.003.003-.004l.004-.004.004-.004.003-.003.004-.004.004-.004a.626.626 0 0 1 .004-.003c0-.002.002-.003.003-.004l.004-.004.003-.003.004-.004a.116.116 0 0 1 .01-.01l.004-.004.004-.003a.1.1 0 0 1 .003-.004l.003-.003a.109.109 0 0 1 .004-.003c0-.002.002-.003.003-.004l.003-.003a1.031 1.031 0 0 1 .014-.013l.003-.003c0-.002.002-.003.003-.004a.096.096 0 0 0 .003-.003l.003-.003.003-.003.003-.003.003-.003a.866.866 0 0 1 .006-.006l.003-.003a.832.832 0 0 1 .003-.003l.003-.003.003-.003.003-.003.003-.003.003-.003.003-.002.002-.003.003-.003.003-.003.002-.002.003-.003.003-.002.002-.003.003-.003.002-.002.003-.003.002-.002.003-.003.002-.002.003-.002.002-.003.002-.002.003-.003.002-.002.002-.002.003-.002c0-.001 0-.002.002-.002l.002-.003.002-.002.002-.002.002-.002a.2.2 0 0 1 .002-.002l.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002a.155.155 0 0 1 .003-.003l.002-.002.002-.002.002-.001.001-.002.002-.002.001-.001.002-.002.002-.001.001-.002.002-.001v-.002l.002-.001.002-.001.001-.002.001-.001.002-.001v-.002a.134.134 0 0 1 .004-.003l.001-.001.001-.001.001-.001.001-.001.001-.001.001-.001h.001v-.002h.002v-.001l.001-.001.002-.001v-.001l.001-.001.001-.001.001-.001h.001v-.001h.001L26 9zm-2.707 1.293c.173-.173.343-.193.27-.176a1.45 1.45 0 0 1-.208.026c-.234.018-.56.02-.949.007-.772-.024-1.67-.096-2.33-.147l-.153 1.994c.641.05 1.593.127 2.42.152.412.013.823.015 1.164-.011.169-.013.35-.035.52-.075.121-.029.432-.108.68-.356l-1.414-1.414zm-3.216-.29c-.515-.04-1.053.08-1.527.23-.489.155-.997.373-1.478.6-.482.229-.961.478-1.388.7-.437.229-.805.422-1.103.559l.838 1.816c.352-.163.771-.382 1.19-.601.43-.225.876-.456 1.319-.665.444-.21.86-.386 1.228-.503.383-.121.632-.152.767-.142l.154-1.994zm-5.496 2.089c-.692.32-1.356.747-1.664 1.414-.354.768-.096 1.494.235 2.024l1.696-1.06a.699.699 0 0 1-.1-.208c0-.002.001.01-.001.03a.181.181 0 0 1-.014.052c-.01.02.002-.019.112-.106.111-.088.292-.2.574-.33l-.838-1.816zm-1.429 3.438c.427.684 1.31 1.242 2.323 1.531 1.06.303 2.386.353 3.83-.109l-.61-1.904c-1.056.338-1.98.288-2.67.09-.737-.21-1.104-.552-1.177-.668l-1.696 1.06zm6.135 1.428c.677-.203 1.416-.047 2.065.235a5.393 5.393 0 0 1 1.018.584l.008.006h-.001v-.001h-.001L23 17c.625-.78.624-.781.624-.781l-.002-.002-.003-.002-.009-.007-.026-.02a6.368 6.368 0 0 0-.387-.27 7.42 7.42 0 0 0-1.05-.56c-.85-.369-2.111-.713-3.434-.316l.574 1.916zm3.006.75 8 8 1.414-1.415-8-8-1.414 1.414zm-9-8 3 3 1.414-1.415-3-3-1.414 1.414zm20 7.585-4.5 4.5 1.414 1.414 4.5-4.5-1.414-1.414z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="donation-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M2 19a1 1 0 1 0 0 2v-2zm36 2a1 1 0 1 0 0-2v2zM21 8a1 1 0 1 0-2 0h2zm-2 24a1 1 0 1 0 2 0h-2zm7-13.7-.676-.737a.892.892 0 0 0-.031.03L26 18.3zm-12 0 .708-.707a.986.986 0 0 0-.032-.03l-.675.737zm0 4.7a1 1 0 1 0 0 2v-2zm12 2a1 1 0 1 0 0-2v2zM2 21h36v-2H2v2zM19 8v24h2V8h-2zm6.293 9.593c-.099.099-.415.283-1.02.49-.559.193-1.23.361-1.892.501a32.888 32.888 0 0 1-2.491.422l-.01.001h-.001L20 20l.122.993h.001l.004-.001c.003 0 .007 0 .012-.002.01 0 .025-.003.044-.005a27.755 27.755 0 0 0 .752-.108 35.006 35.006 0 0 0 1.859-.336c.7-.148 1.46-.336 2.13-.566.623-.214 1.332-.517 1.783-.968l-1.414-1.414zM20 20l.925.38v-.002l.004-.008.013-.03.05-.121c.045-.105.11-.258.192-.445.163-.375.392-.885.654-1.427a23.39 23.39 0 0 1 .839-1.596c.297-.508.55-.864.73-1.044l-1.414-1.414c-.37.37-.73.914-1.042 1.447a25.492 25.492 0 0 0-.914 1.737 43.527 43.527 0 0 0-.957 2.13l-.004.01v.002l-.001.001L20 20zm3.407-4.293a2.28 2.28 0 0 1 1.328-.663c.446-.05.77.074.958.263l1.414-1.414c-.711-.712-1.688-.937-2.592-.837-.907.1-1.816.53-2.522 1.237l1.414 1.414zm2.286-.4c.404.405.515 1.446-.369 2.256l1.352 1.474c1.516-1.39 1.827-3.749.431-5.144l-1.414 1.414zm-12.4 3.7c.452.451 1.161.754 1.784.968.669.23 1.429.418 2.13.566a35.003 35.003 0 0 0 2.61.444l.044.005.012.002h.005L20 20l.122-.993h-.003l-.008-.001a4.733 4.733 0 0 1-.189-.025 32.903 32.903 0 0 1-2.303-.397 16.575 16.575 0 0 1-1.892-.5c-.605-.208-.92-.392-1.02-.491l-1.414 1.414zM20 20l.925-.38-.001-.003-.004-.01a5.06 5.06 0 0 0-.07-.165 43.862 43.862 0 0 0-.887-1.964 25.3 25.3 0 0 0-.914-1.738c-.312-.533-.67-1.077-1.041-1.447l-1.415 1.414c.18.18.433.536.73 1.044.287.488.577 1.053.84 1.596a41.814 41.814 0 0 1 .908 2.023l.003.008v.001L20 20zm-1.992-5.707a4.278 4.278 0 0 0-2.522-1.237c-.905-.1-1.881.126-2.593.837l1.415 1.414c.188-.189.512-.313.957-.263.444.05.935.27 1.328.663l1.415-1.414zm-5.114-.4c-1.396 1.395-1.085 3.754.43 5.144l1.352-1.474c-.884-.81-.773-1.851-.368-2.256l-1.415-1.414zM20 20l-.997-.076v-.01.01a2.68 2.68 0 0 1-.093.403 3.31 3.31 0 0 1-.558 1.054C17.778 22.11 16.585 23 14 23v2c3.115 0 4.922-1.11 5.923-2.381.485-.616.75-1.23.896-1.696a4.668 4.668 0 0 0 .169-.756 2.448 2.448 0 0 0 .009-.086v-.005L20 20zm0 0-.999.051v.005l.001.008.001.02a2.604 2.604 0 0 0 .029.24c.022.147.061.346.13.581.136.468.392 1.088.873 1.708C21.028 23.895 22.842 25 26 25v-2c-2.642 0-3.828-.895-4.385-1.613a3.15 3.15 0 0 1-.533-1.042 2.558 2.558 0 0 1-.083-.398v-.009.012L20 20zM6 32c-1.546 0-2.493-.386-3.063-.964C2.365 30.454 2 29.503 2 28H0c0 1.797.435 3.346 1.513 4.44C2.593 33.535 4.146 34 6 34v-2zm-4-4V12H0v16h2zm0-16c0-1.504.365-2.454.937-3.036C3.507 8.386 4.454 8 6 8V6c-1.854 0-3.407.464-4.487 1.56C.435 8.655 0 10.205 0 12h2zm4-4h28V6H6v2zm28 0c1.546 0 2.493.386 3.063.964.572.582.937 1.532.937 3.036h2c0-1.796-.435-3.346-1.513-4.44C37.407 6.465 35.854 6 34 6v2zm4 4v16h2V12h-2zm0 16c0 1.4-.477 2.35-1.217 2.97-.766.643-1.937 1.03-3.483 1.03v2c1.854 0 3.533-.462 4.767-1.496C39.327 31.45 40 29.901 40 28h-2zm-4.7 4H6v2h27.3v-2z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="event-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m22.3 17.1 4.7.9-3.3 3.4.6 4.6-4.3-2-4.3 2 .6-4.6L13 18l4.7-.9L20 13l2.3 4.1z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"></path>
                                                <path d="M38 33H2c-.6 0-1-.4-1-1V8c0-.6.4-1 1-1h36c.6 0 1 .4 1 1v24c0 .6-.4 1-1 1z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="membership-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M23 15a1 1 0 1 0 0 2v-2zm10 2a1 1 0 1 0 0-2v2zm-10 2a1 1 0 1 0 0 2v-2zm7 2a1 1 0 1 0 0-2v2zm-7 2a1 1 0 1 0 0 2v-2zm8 2a1 1 0 1 0 0-2v2zm-15.392.51a1 1 0 0 0 1.585-1.22l-1.585 1.22zm-9-1.22a1 1 0 0 0 1.585 1.22l-1.585-1.22zM37 32H3v2h34v-2zM3 32c-.548 0-1-.452-1-1H0c0 1.652 1.348 3 3 3v-2zm-1-1V9H0v22h2zM2 9c0-.548.452-1 1-1V6C1.348 6 0 7.348 0 9h2zm1-1h34V6H3v2zm34 0c.548 0 1 .452 1 1h2c0-1.652-1.348-3-3-3v2zm1 1v22h2V9h-2zm0 22c0 .548-.452 1-1 1v2c1.652 0 3-1.348 3-3h-2zM23 17h10v-2H23v2zm0 4h7v-2h-7v2zm0 4h8v-2h-8v2zm-9.1-7a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4h-2zm-2 2a2 2 0 0 1-2-2h-2a4 4 0 0 0 4 4v-2zm-2-2a2 2 0 0 1 2-2v-2a4 4 0 0 0-4 4h2zm2-2a2 2 0 0 1 2 2h2a4 4 0 0 0-4-4v2zm5.293 8.29c-1.184-1.539-3.173-2.59-5.293-2.59v2c1.48 0 2.891.748 3.708 1.81l1.585-1.22zM11.9 21.7c-2.12 0-4.109 1.051-5.292 2.59l1.585 1.22c.816-1.062 2.227-1.81 3.707-1.81v-2z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="food-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <g clip-path="url(#clip0)">
                                                    <path d="M14.293 21.85 1.758 34.132c-1.01.99-1.01 2.972 0 3.962 1.011.99 3.033.99 4.044 0l12.737-14.859m4.145-4.953c1.214-1.283 2.528-2.675 2.528-2.675 1.718 1.684 4.288 1.392 6.47-.693 2.18-2.086 5.812-6.747 6.065-7.33.253-.585.71-1.385 0-2.081a1.487 1.487 0 0 0-2.123 0m0 0c-.1.099-.1.099 0 0zm0 0c.607-.595.607-1.486 0-2.08a1.487 1.487 0 0 0-2.123 0m2.123 2.08s-3.942 3.92-6.124 6.124m4.001-8.204c-.1.099-.1.099 0 0zm0 0c.607-.595.607-1.486 0-2.08-.606-.595-1.367-.47-2.123 0-.755.468-7.48 5.943-7.48 5.943-1.82 1.486-2.427 4.656-.708 6.34 0 0-1.61 1.34-2.83 2.476M33.5 3.423s-1.001 1.077-6 6.001M3.78 1.442S37 32 38.15 33.142c1.152 1.142.81 4.061 0 4.953-.909.892-3.74 1.486-5.054 0L22.987 24.227c-.808-.991-3.74-.991-5.054-.991-1.416 0-3.235-.892-4.044-1.981L4.791 10.358C2.97 7.98 2.162 4.018 3.78 1.442z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                                                </g>
                                                <defs>
                                                    <clippath id="clip0">
                                                        <path d="M0 0h40v40H0z" fill="var(--background-fill)"></path>
                                                    </clippath>
                                                </defs>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="image-icon" viewbox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="64" width="64" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                                <path clip-rule="evenodd" d="M28.372 28.25c1.196 0 2.166-1.007 2.166-2.25s-.97-2.25-2.166-2.25-2.166 1.007-2.166 2.25.97 2.25 2.166 2.25zm-1.288 3.913a1 1 0 0 0-1.562.154L21.42 38.71a1 1 0 0 0 .841 1.54h19.504a1 1 0 0 0 .857-1.515l-5.552-9.23a1 1 0 0 0-1.65-.094l-4.173 5.42a1 1 0 0 1-1.513.083l-2.649-2.752z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="section-icon" viewbox="0 0 16 16">
                                            <path d="M.667.057a.993.993 0 0 0-.66 1.021.96.96 0 0 0 .556.819l.201.099 7.174.008c6.45.007 7.19.003 7.336-.039.354-.103.576-.325.709-.708.052-.147.062-.42.019-.499a5.394 5.394 0 0 1-.09-.189 1.078 1.078 0 0 0-.482-.476l-.165-.078-7.22-.007C1.114.002.819.004.667.057m-.657.949c0 .115.005.159.012.097a1.238 1.238 0 0 0 0-.211C.015.839.01.89.01 1.006m.753 3.021a1.11 1.11 0 0 0-.557.368c-.219.291-.208.084-.199 3.665l.008 3.212.083.169c.097.198.298.395.497.487l.14.064 7.23.008 7.229.008.175-.071a.999.999 0 0 0 .597-.629c.064-.173.064-.184.064-3.354 0-2.101-.01-3.181-.03-3.181-.017 0-.03-.021-.03-.046 0-.136-.233-.451-.422-.57-.277-.175.223-.165-7.546-.161-4.21.002-7.167.014-7.239.031M.014 8c0 1.767.004 2.485.009 1.596.004-.888.004-2.334 0-3.212C.018 5.506.014 6.233.014 8m1.997 0v1.996h11.978V6.004H2.011V8M.832 14.02a1.028 1.028 0 0 0-.739.569c-.065.138-.078.208-.078.42 0 .213.013.283.078.421.093.196.287.395.476.488l.136.067 7.256.008 7.255.007.169-.063c.367-.137.645-.56.645-.981 0-.103-.01-.187-.023-.187s-.047-.068-.077-.151c-.073-.207-.32-.451-.55-.544l-.175-.07L8.09 14c-3.913-.003-7.179.006-7.258.02m-.822.989c0 .124.005.175.012.113a1.408 1.408 0 0 0 0-.225c-.007-.062-.012-.011-.012.112" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="category-folder-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M39 17a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4m14.5-8L11 5H2a1 1 0 0 0-1 1v27a2 2 0 0 0 2 2h34a2 2 0 0 0 2-2V10a1 1 0 0 0-1-1H15.5z" stroke="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="phone-icon" viewbox="0 0 16 16">
                                            <svg fill="none" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m9.606 9.333-.04.04-.035.044-.526.66A9.316 9.316 0 0 1 5.94 7.036l.683-.581.037-.032.034-.036a1.68 1.68 0 0 0 .394-1.673l-.002-.009-.003-.008A6.435 6.435 0 0 1 6.76 2.66C6.76 1.748 6.012 1 5.1 1H2.793c-.303 0-.716.063-1.087.311A1.585 1.585 0 0 0 1 2.66C1 9.406 6.601 15 13.34 15a1.59 1.59 0 0 0 1.326-.681c.253-.361.334-.774.334-1.106v-2.3c0-.912-.748-1.66-1.66-1.66-.71 0-1.397-.115-2.039-.322a1.652 1.652 0 0 0-1.695.402z" stroke="var(--icon-fill)" stroke-width="2"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="direction-icon" viewbox="0 0 21 21">
                                            <svg fill="none" height="21" width="21" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m19.71 10.29-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM12 13.5V11H8v3H6v-4c0-.55.45-1 1-1h5V6.5l3.5 3.5-3.5 3.5z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="map-icon" viewbox="0 0 20 19">
                                            <svg fill="none" height="19" width="20" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m19.32 2.05-6-2h-.07a.7.7 0 0 0-.14 0h-.43L7 2 1.32.05a1 1 0 0 0-.9.14A1 1 0 0 0 0 1v14a1 1 0 0 0 .68.95l6 2a1 1 0 0 0 .62 0l5.7-1.9L18.68 18c.106.014.214.014.32 0a.94.94 0 0 0 .58-.19A1.001 1.001 0 0 0 20 17V3a1 1 0 0 0-.68-.95zM6 15.61l-4-1.33V2.39l4 1.33v11.89zm6-1.33-4 1.33V3.72l4-1.33v11.89zm6 1.33-4-1.33V2.39l4 1.33v11.89z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="list-icon" viewbox="0 0 24 24">
                                            <svg fill="none" height="24" width="24" xmlns="http://www.w3.org/2000/svg">
                                                <path clip-rule="evenodd" d="M3 2a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3zm1 18V4h16v16H4zM7 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm1 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm2-8a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-6zm-1 5a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                            </svg>
                                        </symbol>
                                    </svg>undefined undefined
                                </div>undefinedundefined<div class="cko__footer cko--max-width">
                                    <div class="cko__footer-divider 📚19-4-0_q2yX" style="--divider-color: #797e83; --divider-size: 1px;"></div>undefined undefined
                                </div>undefinedundefined</div>undefined undefined
                        </div>undefined undefined
                    </div>undefined undefined
                </div>undefinedundefined<script>
                    // Get all the category elements
                    const categoryItems = document.querySelectorAll(".category-item");
                    // Function to hide all overlays
                    function hideAllOverlays() {
                        const overlays = document.querySelectorAll(".widget-overlay");
                        overlays.forEach(overlay => {
                            overlay.style.display = "none";
                        });
                    }
                    // Add click event listener to each category
                    categoryItems.forEach(categoryItem => {
                        categoryItem.addEventListener("click", function() {
                            // Hide all overlays
                            hideAllOverlays();
                            // Get the widget overlay within the clicked category
                            const widgetOverlay = categoryItem.querySelector(".widget-overlay");
                            // Display the clicked widget overlay
                            if (widgetOverlay) {
                                widgetOverlay.style.display = "flex";
                            }
                        });
                    });
                </script>undefinedundefined<script>
                    if (typeof customOverlayScriptLoaded === 'undefined') {
                        var customOverlayScriptLoaded = true;
                        console.log('Custom script for category overlays is loaded.');
                        // Get all the category elements
                        var uniqueCategoryItems = document.querySelectorAll(".category-item");
                        // Function to hide all overlays
                        function hideUniqueOverlays() {
                            console.log('Hiding all overlays.');
                            var uniqueOverlays = document.querySelectorAll(".category-image__overlay-fill");
                            uniqueOverlays.forEach(function(overlay) {
                                overlay.style.display = "none";
                            });
                        }
                        // Add click event listener to each category
                        uniqueCategoryItems.forEach(function(categoryItem) {
                            console.log('Adding click event listener to a category.');
                            categoryItem.addEventListener("click", function() {
                                console.log('A category was clicked.');
                                // Hide all overlays
                                hideUniqueOverlays();
                                // Get the widget overlay within the clicked category
                                var uniqueWidgetOverlay = categoryItem.querySelector(".category-image__overlay-fill");
                                // Display the clicked widget overlay
                                if (uniqueWidgetOverlay) {
                                    console.log('Displaying the overlay for the clicked category.');
                                    uniqueWidgetOverlay.style.display = "block";
                                }
                            });
                        });
                    }
                </script>undefined undefined
            </body>undefined undefined
    </html>e: 30;
                    --type-scale: 2;
                    --primary-font: Roboto;
                    --secondary-font: Rotis;
                    --primary-font-weight: 500;
                    --secondary-font-weight: 400;
                    --ui-font: Roboto;
                    --ui-font-weight: 500;
                    --title-font: var(--primary-font);
                    --title-font-weight: var(--primary-font-weight);
                    --body-font: var(--secondary-font);
                    --body-font-weight: var(--secondary-font-weight);
                    --site-title-font: var(--primary-font);
                    --site-title-font-weight: var(--primary-font-weight);
                    --headline-font: var(--primary-font);
                    --headline-font-weight: var(--primary-font-weight);
                    --section-title-font: var(--primary-font);
                    --section-title-font-weight: var(--primary-font-weight);
                    --section-callout-font: var(--primary-font);
                    --section-callout-font-weight: var(--primary-font-weight);
                    --attribution-font: var(--ui-font);
                    --attribution-font-weight: var(--ui-font-weight);
                    --navigation-font: var(--ui-font);
                    --navigation-font-weight: var(--ui-font-weight);
                    --product-price-font: var(--ui-font);
                    --product-price-font-weight: var(--ui-font-weight);
                    --button-font: var(--ui-font);
                    --button-font-weight: var(--ui-font-weight);
                    --primary-color: #212121;
                    --color-secondary-minimal-black-iojGVX: #141414;
                    --color-secondary-VHIwge: #efefef;
                    --color-secondary-FnDBxW: #e00c0c;
                    --color-secondary-PMAiaY: #ffffff;
                    --gray-light-one: #f6f7f9;
                    --gray-light-two: #ebedef;
                    --gray-dark: #343b42;
                    --color-white: #ffffff;
                    --color-black: #000000;
                    --primary-bright-dark: #463939;
                    --primary-subtle-dark: #301d1d;
                    --primary-bright-light: #c6b9b9;
                    --primary-subtle-light: #f5efef;
                    --primary-contrast-color: #ffffff;
                    --secondary-bright-dark: #2d3953;
                    --secondary-subtle-dark: #1d2330;
                    --secondary-bright-light: #acb9d2;
                    --secondary-subtle-light: #eff1f5;
                    --secondary-contrast-color: #000000;
                    --site-background-color: var(--gray-dark);
                    --gutter-column-xs: 16px;
                    --gutter-column-sm: 16px;
                    --gutter-column-md: 16px;
                    --gutter-column-lg: 16px;
                    --gutter-column-xl: 16px;
                    --gutter-row-xs: 16px;
                    --gutter-row-sm: 16px;
                    --gutter-row-md: 16px;
                    --gutter-row-lg: 16px;
                    --gutter-row-xl: 16px;
                }

                .container {
                    margin: 0 auto;
                }

                .w-block--contain-none .container {
                    max-width: none;
                }

                .w-block--contain-block {
                    max-width: 1200px;
                }
            </style>
            <link href="https://cdn3.editmysite.com/app/website/js/../css/navigation-mobile.593f75ea0cd0339afd2f.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/96166.a59f11c08794eed75e2e.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/cart-1.1dec8a579994a914542f.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/6090.b53863a235f919eb5672.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/header-6.34ba4b2b95abd8de0be9.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/featured-categories-fullbleed-overlay.f7863162d9c530ec6017.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/26011.684ff466fa4a1f0c5942.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/footer-7.7d9df2bbcb508697998e.css" rel="stylesheet" type="text/css" />
            <link href="https://cdn3.editmysite.com/app/website/js/../css/free-footer.86d148e5cb2be7f08d49.css" rel="stylesheet" type="text/css" />
        </head>
        <body>
            <body class="show-all-popups">
                <div class="app-container" data-v-90c54f5a="">
                    <div class="📚19-4-0rI2oH" data-v-90c54f5a="" style='--maker-color-neutral-0: #343b42; --maker-color-neutral-10: #5d6368; --maker-color-neutral-20: #797e83; --maker-color-neutral-80: #9da1a5; --maker-color-neutral-90: #f4f4f5; --maker-color-neutral-100: #ffffff; --maker-color-primary: #212121; --maker-color-background: #343b42; --maker-color-heading: #ffffff; --maker-color-body: #ffffff; --maker-color-elevation: #797e83; --maker-color-overlay: rgba(255, 255, 255, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px;'>
                        <div class="📚19-4-0QtxK6 📚19-4-0_EoEp theme-square w-background-dark" data-v-90c54f5a="" id="app">
                            <div class="" data-v-90c54f5a="" tabindex="0">
                                <div class="reset-z-index" data-v-b0348236="">
                                    <!-- -->
                                    <div data-v-5b51b8b9="" data-v-b0348236="">
                                        <div class="slideout" data-v-5b51b8b9="" data-v-d5f23816="" style="--slideout-max-height: 293px; display: none;">
                                            <div class="slideout__overlay" data-v-d5f23816=""></div>
                                            <div data-v-d5f23816="">
                                                <div class="w-container slideout__content col slideout--right" data-v-614c05a6="" data-v-d5f23816="">
                                                    <div class="w-cell slideout__row row" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" data-v-d5f23816="">
                                                        <div class="w-block-wrapper" data-block-purpose="nav-mobile@^1.2.1" data-v-301e84c2="" data-v-d5f23816="" id="lSiIEt" type="block">
                                                            <div data-v-301e84c2="">
                                                                <div class="nav-mobile w-block w-background-dark" data-v-1170136a="" data-v-301e84c2="" data-v-34fad261="" id="2a1c29f2-4a97-11ee-9720-3b85166b6faf" isdark="true" layout="navigation-mobile" shortid="lSiIEt" style="background-color: var(--gray-dark); --text-color: #ffffff; --text-color-10: #494f55; --text-color-20: #5d6368; --text-color-30: #71767b; --text-color-40: #868a8e; --text-color-50: #9a9da1; --text-color-60: #aeb1b4; --text-color-70: #c3c5c7; --text-color-80: #d7d8da; --text-color-90: #ebeced; --text-color-alpha-10: rgba(255, 255, 255, 0.1); text-align: center; flex-direction: column; height: 100vh;">
                                                                    <div class="container content-align--center" data-v-34fad261="">
                                                                        <div class="w-container row" data-v-34fad261="" data-v-614c05a6="">
                                                                            <div class="w-cell col col-10 col-sm-10 col-md-10 col-lg-10 cell--empty align--left" data-v-34fad261="" data-v-614c05a6="" data-v-6bcfc41e="" style="margin-top: calc(var(--gutter-row-xs) * 1); margin-bottom: calc(var(--gutter-row-xs) * 1);"></div>
                                                                            <div class="w-cell col col-2 col-sm-2 col-md-2 col-lg-2 align--right" data-v-34fad261="" data-v-614c05a6="" data-v-6bcfc41e="" style="margin-top: calc(var(--gutter-row-xs) * 1); margin-bottom: calc(var(--gutter-row-xs) * 1);">
                                                                                <div class="w-wrapper" data-v-34fad261="" data-v-6bcfc41e="" data-v-ab1ca44a="">
                                                                                    <div class="nav-icon nav-icon__close" data-v-34fad261="" data-v-70b8cb91="" data-v-ab1ca44a="" id="2a3493f6-4a97-11ee-9720-3b85166b6faf">
                                                                                        <span class="icon 📚19-4-0vCfSe" data-v-4700918e="" data-v-70b8cb91="" style="--color: var(--color-white); --icon-size: 24px; --fill: currentColor;">
                                                                                            <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                <path d="m6.71 18.71 5.29-5.3 5.29 5.3 1.42-1.42-5.3-5.29 5.3-5.29-1.42-1.42-5.29 5.3-5.29-5.3-1.42 1.42 5.3 5.29-5.3 5.29 1.42 1.42Z" fill="currentColor"></path>
                                                                                            </svg>
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div class="nav-scroll" data-v-34fad261="">
                                                                        <!-- -->
                                                                        <div class="w-wrapper" data-v-34fad261="" data-v-ab1ca44a="">
                                                                            <div data-v-34fad261="" data-v-53e2d1eb="" data-v-ab1ca44a="" id="2a3493f5-4a97-11ee-9720-3b85166b6faf">
                                                                                <nav class="w-nav nav--mobile" data-v-53e2d1eb="">
                                                                                    <ul class="nav__main ready nav--uppercase" data-v-6384e47a="" style="text-align: center; --nav-color-link: var(--color-white); --nav-color-underline: var(--color-white);">
                                                                                        <!-- The rest of the navigation bar content provided by the user is here... -->
                                                                                    </ul>
                                                                                </nav>
                                                                            </div>
                                                                        </div>
                                                                        <!-- -->
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div class="w-block-wrapper" data-block-purpose="cart@^1.3.6" data-v-301e84c2="" data-v-d5f23816="" id="WENSBt" style="display: none;" type="block">
                                                            <div class="📚19-4-0rI2oH" data-v-301e84c2="" style='--maker-color-neutral-0: #ffffff; --maker-color-neutral-10: #f1f1f1; --maker-color-neutral-20: #d3d3d3; --maker-color-neutral-80: #707070; --maker-color-neutral-90: #1b1b1b; --maker-color-neutral-100: #000000; --maker-color-primary: #212121; --maker-color-background: #ffffff; --maker-color-heading: #000000; --maker-color-body: #000000; --maker-color-elevation: #ffffff; --maker-color-overlay: rgba(0, 0, 0, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px; background: none;'>
                                                                <div class="slideout-cart-container w-block 📚19-4-0rI2oH" data-v-301e84c2="" data-v-48cacf2f="" id="2a1c29f3-4a97-11ee-9720-3b85166b6faf" layout="cart-1" shortid="WENSBt" style='--maker-color-neutral-0: #343b42; --maker-color-neutral-10: #5d6368; --maker-color-neutral-20: #797e83; --maker-color-neutral-80: #9da1a5; --maker-color-neutral-90: #f4f4f5; --maker-color-neutral-100: #ffffff; --maker-color-primary: #212121; --maker-color-background: #343b42; --maker-color-heading: #ffffff; --maker-color-body: #ffffff; --maker-color-elevation: #797e83; --maker-color-overlay: rgba(255, 255, 255, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px;'>
                                                                    <form data-v-48cacf2f="">
                                                                        <div background="[object Object]" class="blade-wrapper" content-align="" data-v-2e2967c3="" data-v-48cacf2f="" data-v-c07a14ba="" elements="[object Object]" style="--fulfillment-button-color: var(--maker-color-neutral-100);" styles="[object Object]">
                                                                            <!-- -->
                                                                            <div class="heading compact-style-heading" data-v-2e2967c3="">
                                                                                <div class="heading-content" data-v-2e2967c3="">
                                                                                    <h3 class="heading-title" data-v-2e2967c3=""> Shopping Cart </h3>
                                                                                    <div class="icon-wrapper" data-v-2e2967c3="">
                                                                                        <span class="icon heading-icon 📚19-4-0vCfSe" data-v-2e2967c3="" data-v-4700918e="" style="--color: currentColor; --icon-size: 16px; --fill: currentColor;">
                                                                                            <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                <path d="m6.71 18.71 5.29-5.3 5.29 5.3 1.42-1.42-5.3-5.29 5.3-5.29-1.42-1.42-5.29 5.3-5.29-5.3-1.42 1.42 5.3 5.29-5.3 5.29 1.42 1.42Z" fill="currentColor"></path>
                                                                                            </svg>
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                                <div class="banner" data-v-2e2967c3="">
                                                                                    <div data-v-2e2967c3="" data-v-c07a14ba="">
                                                                                        <!-- -->
                                                                                        <!-- -->
                                                                                        <!-- -->
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div class="content" data-v-2e2967c3="">
                                                                                <div class="cart-middle" data-v-2e2967c3="" data-v-c07a14ba="">
                                                                                    <div class="w-container cart-slideout-container col" data-v-2e2967c3="" data-v-614c05a6="" data-v-c07a14ba="">
                                                                                        <div class="w-cell row align--center" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" data-v-c07a14ba="">
                                                                                            <div class="text-component 📚19-4-0uGevg 📚19-4-0W7uVy w-text--rendered" data-v-54fd6eb4="" data-v-6bcfc41e="" data-v-7df72e6e="" data-v-c07a14ba="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); --inline-link-color: var(--primary-color); padding-left: 0em;'>
                                                                                                <p>You don't have any items in your cart.</p>
                                                                                            </div>
                                                                                            <!-- -->
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <!-- -->
                                                                            </div>
                                                                            <div class="footing" data-v-2e2967c3="" style="display: none;">
                                                                                <div class="cart-slideout-container__checkout js-cart-slideout-container__checkout" data-v-2e2967c3="" data-v-c07a14ba="">
                                                                                    <!-- -->
                                                                                    <button class="cart-slideout-container__checkout-button 📚19-4-0vQBWk 📚19-4-0wcHKQ 📚19-4-0S6z9M 📚19-4-0_N8aS 📚19-4-0vaDLi" data-v-2e2967c3="" data-v-c07a14ba="" disabled="disabled" style="--color-main: #e00c0c; --color-contrast: #ffffff; --color-hover: #f32222; --color-active: #f54848; --color-focus: #e00c0c4d;" type="button">
                                                                                        <!-- -->
                                                                                        <span class="📚19-4-0DK0_A 📚19-4-0O_pqx"> Checkout </span>
                                                                                        <!-- -->
                                                                                    </button>
                                                                                </div>
                                                                                <div class="font--large continue-shopping" data-v-2e2967c3="" data-v-c07a14ba="">
                                                                                    <button class="📚19-4-0_xxoX 📚19-4-0t5BZq" data-v-2e2967c3="" data-v-c07a14ba="" style="--color: #ffffff;" type="button">
                                                                                        <!-- -->
                                                                                        <span class="📚19-4-0qfj5z"> Continue Shopping </span>
                                                                                    </button>
                                                                                </div>
                                                                                <div class="cart-section__divider 📚19-4-0_q2yX" data-v-2e2967c3="" data-v-c07a14ba="" style="--divider-color: #797e83; --divider-size: 1px;"></div>
                                                                                <div class="accepted-pay accepted-pay--new-line" data-v-2e2967c3="" data-v-c07a14ba="">
                                                                                    <div class="accepted-pay__text" data-v-2e2967c3="" data-v-c07a14ba=""> Accepted here </div>
                                                                                    <div class="payment-methods" data-v-2e2967c3="" data-v-584fc356="" data-v-c07a14ba="">
                                                                                        <span class="square-pay" data-v-584fc356="">
                                                                                            <svg class="square-pay__icon" data-v-584fc356="" height="24" version="1.1" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                                                                                                <path d="M 3.469 0.034 C 2.879 0.110, 2.269 0.345, 1.740 0.699 C 1.451 0.892, 0.892 1.451, 0.699 1.740 C 0.397 2.191, 0.186 2.694, 0.069 3.240 C 0.018 3.483, 0.015 3.896, 0.015 12 C 0.015 20.104, 0.018 20.517, 0.069 20.760 C 0.248 21.594, 0.587 22.222, 1.182 22.819 C 1.767 23.405, 2.411 23.753, 3.240 23.931 C 3.483 23.982, 3.896 23.985, 12 23.985 C 20.221 23.985, 20.514 23.983, 20.775 23.928 C 21.295 23.819, 21.811 23.602, 22.260 23.301 C 22.549 23.108, 23.108 22.549, 23.301 22.260 C 23.672 21.706, 23.970 20.890, 23.970 20.431 C 23.970 20.365, 23.983 20.310, 24 20.310 C 24.020 20.310, 24.030 17.508, 24.030 11.963 C 24.029 6.562, 24.019 3.631, 24 3.660 C 23.979 3.693, 23.971 3.670, 23.970 3.576 C 23.969 3.262, 23.788 2.634, 23.577 2.214 C 23.375 1.812, 23.172 1.536, 22.818 1.182 C 22.242 0.607, 21.643 0.274, 20.835 0.081 L 20.565 0.017 12.120 0.012 C 7.333 0.009, 3.586 0.019, 3.469 0.034 M 0.015 12 C 0.015 16.595, 0.018 18.475, 0.022 16.178 C 0.027 13.880, 0.027 10.120, 0.022 7.823 C 0.018 5.525, 0.015 7.405, 0.015 12 M 5.646 4.847 C 5.308 4.938, 5.012 5.197, 4.884 5.514 L 4.815 5.685 4.815 12 L 4.815 18.315 4.884 18.484 C 4.966 18.687, 5.137 18.889, 5.333 19.016 C 5.641 19.213, 5.196 19.202, 12.077 19.193 L 18.315 19.185 18.486 19.116 C 18.688 19.034, 18.924 18.832, 19.033 18.646 C 19.211 18.342, 19.201 18.735, 19.193 11.923 L 19.185 5.685 19.113 5.505 C 19.014 5.259, 18.741 4.986, 18.495 4.887 L 18.315 4.815 12.060 4.809 C 6.704 4.804, 5.782 4.810, 5.646 4.847 M 9.409 9.044 C 9.261 9.097, 9.128 9.222, 9.057 9.375 C 9.004 9.489, 9.001 9.625, 9.001 11.970 C 9 13.692, 9.010 14.481, 9.034 14.565 C 9.077 14.721, 9.279 14.923, 9.435 14.966 C 9.603 15.013, 14.397 15.013, 14.565 14.966 C 14.635 14.947, 14.736 14.882, 14.809 14.809 C 14.882 14.736, 14.947 14.635, 14.966 14.565 C 15.013 14.397, 15.013 9.603, 14.966 9.435 C 14.923 9.279, 14.721 9.077, 14.565 9.034 C 14.481 9.010, 13.698 9.001, 11.985 9.001 C 9.974 9.002, 9.504 9.010, 9.409 9.044" fill-rule="evenodd"></path>
                                                                                            </svg>
                                                                                        </span>
                                                                                        <img alt="Apple Pay" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/applepay.svg" />
                                                                                        <img alt="Google Pay" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/googlepay.svg" />
                                                                                        <img alt="Visa" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/visa.svg" />
                                                                                        <img alt="Mastercard" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/mastercard.svg" />
                                                                                        <img alt="American Express" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/americanexpress.svg" />
                                                                                        <img alt="Discover" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/discover.svg" />
                                                                                        <img alt="JCB" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/jcb.svg" />
                                                                                        <img alt="CashApp" class="supported-payment-method" data-v-584fc356="" src="/static/icons/payment-methods/cashapp.svg" />
                                                                                        <!-- -->
                                                                                        <!-- -->
                                                                                        <!-- -->
                                                                                        <!-- -->
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </form>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="w-container main-container col" data-v-5b51b8b9="" data-v-614c05a6="">
                                            <div class="w-cell header-banner-wrapper row" data-v-31605ed0="" data-v-5b51b8b9="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" style="--transparent-header-height: 222px;">
                                                <div class="w-block-wrapper header" data-block-purpose="header" data-v-301e84c2="" data-v-31605ed0="" id="ZTImGA" type="block">
                                                    <div class="📚19-4-0rI2oH" data-v-301e84c2="" style='--maker-color-neutral-0: #000000; --maker-color-neutral-10: #363636; --maker-color-neutral-20: #575757; --maker-color-neutral-80: #848484; --maker-color-neutral-90: #f1f1f1; --maker-color-neutral-100: #ffffff; --maker-color-primary: #212121; --maker-color-background: #000000; --maker-color-heading: #ffffff; --maker-color-body: #ffffff; --maker-color-elevation: #575757; --maker-color-overlay: rgba(255, 255, 255, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px; background: none;'>
                                                        <div class="w-block-header w-block" data-v-301e84c2="" data-v-5861d7e1="" data-v-ad6516ec="" id="2a1c29f1-4a97-11ee-9720-3b85166b6faf" layout="header-6" shortid="ZTImGA" style="--text-color: #ffffff; --text-color-10: #1a1a1a; --text-color-20: #333333; --text-color-30: #4d4d4d; --text-color-40: #666666; --text-color-50: #808080; --text-color-60: #999999; --text-color-70: #b3b3b3; --text-color-80: #cccccc; --text-color-90: #e6e6e6; --text-color-alpha-10: rgba(255, 255, 255, 0.1);" subnavcolor="--color-black" textalign="">
                                                            <div data-v-ad6516ec="" style="height: 0px;"></div>
                                                            <div class="w-block-background" data-v-ad6516ec="" isdark="true" style="background-color: var(--color-black); top: 0px; --sticky-header-bg-color: #343b42;">
                                                                <div class="w-header header-6 container header-content content-align--center" data-v-5861d7e1="" style="text-align: center; min-height: auto; --icons-spacing: calc(var(--gutter-column) * 0.66);">
                                                                    <div class="w-container header__content-container col" data-v-5861d7e1="" data-v-614c05a6="">
                                                                        <div class="w-cell header__top header__condensed row" data-v-5861d7e1="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" style="margin-top: calc(var(--gutter-row-md) * 1.5); margin-bottom: calc(var(--gutter-row-md) * 0);">
                                                                            <div class="header-animate__wrap header__hamburger" data-v-5861d7e1="" data-v-695112c6="" data-v-6bcfc41e="" data-v-8cf4aed2="">
                                                                                <div class="w-wrapper display-mobile" data-v-695112c6="" data-v-8cf4aed2="" data-v-ab1ca44a="">
                                                                                    <div class="hamburger-icon nav-icon nav-icon__hamburger" data-v-70b8cb91="" data-v-8cf4aed2="" data-v-ab1ca44a="" id="2a3493f3-4a97-11ee-9720-3b85166b6faf">
                                                                                        <span class="icon 📚19-4-0vCfSe" data-v-4700918e="" data-v-70b8cb91="" style="--color: var(--color-white); --icon-size: 24px; --fill: currentColor;">
                                                                                            <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                <path clip-rule="evenodd" d="M3 6h18v2H3V6Zm18 5H3v2h18v-2Zm0 5H3v2h18v-2Z" fill="currentColor" fill-rule="evenodd"></path>
                                                                                            </svg>
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div class="header-animate__wrap header__logo" data-v-5861d7e1="" data-v-695112c6="" data-v-6bcfc41e="">
                                                                                <div class="w-wrapper" data-v-695112c6="" data-v-ab1ca44a="">
                                                                                    <a class="logo__link router-link-exact-active router-link-active" data-v-6f51d002="" data-v-ab1ca44a="" href="/booktomnyc/" id="2a3493f0-4a97-11ee-9720-3b85166b6faf" style="text-align: inherit;">
                                                                                        <span class="w-sitelogo" data-v-23d6841e="" data-v-6f51d002="" data-wg-notranslate="" style="text-align: inherit;">
                                                                                            <div class="📚19-4-0emJCV" data-v-23d6841e="" style="--width: 140px; --mobile-width: 60px;">
                                                                                                <!-- -->
                                                                                                <img alt="BookTomNYC logo" class="📚19-4-0j_xX0 📚19-4-0NojeF 📚19-4-0_7QZj" sizes="(min-width: 600px) 140px, 60px" src="https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=2400&amp;optimize=medium" srcset="https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=400&amp;optimize=medium 400w, https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=800&amp;optimize=medium 800w, https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=1200&amp;optimize=medium 1200w, https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=1600&amp;optimize=medium 1600w, https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=2000&amp;optimize=medium 2000w, https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=2400&amp;optimize=medium 2400w" style="--image-height: 140px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </span>
                                                                                    </a>
                                                                                </div>
                                                                            </div>
                                                                            <!-- -->
                                                                            <div class="header__icons header__icons" data-v-5861d7e1="" data-v-6bcfc41e="" data-v-72d6405b="">
                                                                                <div class="header-animate__wrap header__button display-desktop" data-v-695112c6="" data-v-72d6405b=""></div>
                                                                                <div class="w-wrapper icons" data-v-72d6405b="" data-v-ab1ca44a="">
                                                                                    <div class="header-animate__wrap icon header__search" data-v-695112c6="" data-v-72d6405b="" data-v-9820d1ea="" data-v-ab1ca44a="">
                                                                                        <div class="search-icon nav-icon nav-icon__search" data-v-695112c6="" data-v-70b8cb91="" data-v-9820d1ea="">
                                                                                            <button aria-label="Search" class="nav-btn search-icon__wrap" data-v-70b8cb91="">
                                                                                                <span class="icon 📚19-4-0vCfSe" data-v-4700918e="" data-v-70b8cb91="" style="--color: var(--color-white); --icon-size: 24px; --fill: currentColor;">
                                                                                                    <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                        <path d="M10.5 17.5c1.57 0 3.02-.53 4.18-1.4l4.11 4.11 1.41-1.41-4.11-4.11a7 7 0 1 0-12.6-4.18 7 7 0 0 0 7.01 6.99Zm0-12a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" fill="currentColor"></path>
                                                                                                    </svg>
                                                                                                </span>
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                    <!-- -->
                                                                                    <div data-v-72d6405b="" data-v-ab1ca44a="" style="display: contents;">
                                                                                        <div class="header-animate__wrap icon header__cart" data-v-695112c6="" data-v-72d6405b="" data-v-de3485b0="">
                                                                                            <button aria-label="Cart icon" class="nav-btn cart-icon cart-icon__wrap" data-v-695112c6="" data-v-de3485b0="">
                                                                                                <span class="icon 📚19-4-0vCfSe" data-v-4700918e="" data-v-695112c6="" data-v-de3485b0="" style="--color: var(--color-white); --icon-size: 24px; --fill: currentColor;">
                                                                                                    <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                        <path clip-rule="evenodd" d="M7 14a1 1 0 0 0-1 1 1 1 0 0 0 1 1h13v2H7a2.98 2.98 0 0 1-1.33-5.67L4 4H2V2h6v2h12l-2 10H7Zm9.36-2 1.2-6H6.44l1.2 6h8.72ZM7.5 22a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor" fill-rule="evenodd"></path>
                                                                                                    </svg>
                                                                                                </span>
                                                                                                <!-- -->
                                                                                            </button>
                                                                                        </div>
                                                                                        <!-- -->
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div class="search__wrap" data-v-5861d7e1="" data-v-6bcfc41e="" data-v-fa7658ac="">
                                                                                <div class="search-bar__wrap" data-v-fa7658ac="">
                                                                                    <div class="autocomplete-container search-bar" data-v-50a1234d="" data-v-fa7658ac="">
                                                                                        <div class="📚19-4-0rIy1g" data-v-50a1234d="">
                                                                                            <div class="📚19-4-0_FrL8 📚19-4-0_2TXJ">
                                                                                                <input aria-label="Search" class="📚19-4-0U4Dfn 📚19-4-0jZ_Vi" placeholder="Search" />
                                                                                                <span class="📚19-4-0swXoB 📚19-4-0qI9Qu">
                                                                                                    <span class="icon icon-prefix 📚19-4-0vCfSe" data-v-4700918e="" data-v-50a1234d="" style="--color: currentColor; --icon-size: 24px; --fill: var(--color-black);">
                                                                                                        <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                            <path d="M10.5 17.5c1.57 0 3.02-.53 4.18-1.4l4.11 4.11 1.41-1.41-4.11-4.11a7 7 0 1 0-12.6-4.18 7 7 0 0 0 7.01 6.99Zm0-12a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" fill="currentColor"></path>
                                                                                                        </svg>
                                                                                                    </span>
                                                                                                </span>
                                                                                                <span class="📚19-4-0swXoB 📚19-4-0Du2TA">
                                                                                                    <span class="icon 📚19-4-0vCfSe" data-v-4700918e="" data-v-50a1234d="" style="--color: currentColor; --icon-size: 16px; --fill: currentColor;">
                                                                                                        <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                            <path d="m6.71 18.71 5.29-5.3 5.29 5.3 1.42-1.42-5.3-5.29 5.3-5.29-1.42-1.42-5.29 5.3-5.29-5.3-1.42 1.42 5.3 5.29-5.3 5.29 1.42 1.42Z" fill="currentColor"></path>
                                                                                                        </svg>
                                                                                                    </span>
                                                                                                </span>
                                                                                            </div>
                                                                                            <!-- -->
                                                                                        </div>
                                                                                        <!-- -->
                                                                                        <div class="autocomplete-dropdown square__autocomplete_autocompleteDropdown--1EI-5" data-popper-placement="bottom" data-v-1932e3c2="" data-v-50a1234d="" style="display: none; position: absolute; inset: 0px auto auto 0px; margin: 0px; transform: translate(296px, 52px);" value-key="name"></div>
                                                                                    </div>
                                                                                </div>
                                                                                <div class="search-bar__icon--close" data-v-fa7658ac="">
                                                                                    <div class="nav-icon nav-icon__searchClose" data-v-70b8cb91="" data-v-fa7658ac="">
                                                                                        <span class="icon 📚19-4-0vCfSe" data-v-4700918e="" data-v-70b8cb91="" style="--color: var(--color-white); --icon-size: 24px; --fill: currentColor;">
                                                                                            <svg fill="none" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                                                <path d="m6.71 18.71 5.29-5.3 5.29 5.3 1.42-1.42-5.3-5.29 5.3-5.29-1.42-1.42-5.29 5.3-5.29-5.3-1.42 1.42 5.3 5.29-5.3 5.29 1.42 1.42Z" fill="currentColor"></path>
                                                                                            </svg>
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div class="w-cell display-desktop row" data-v-5861d7e1="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" style="margin-top: calc(var(--gutter-row-sm) * 1); margin-bottom: calc(var(--gutter-row-sm) * 1);">
                                                                            <div class="header-animate__wrap header__navigation" data-v-5861d7e1="" data-v-695112c6="" data-v-6bcfc41e="">
                                                                                <div class="w-wrapper" data-v-695112c6="" data-v-ab1ca44a="">
                                                                                    <nav class="w-nav nav--desktop square__navigation-desktop_desktopNav--ZEnDx" data-v-6384e47a="" data-v-ab1ca44a="" id="2a3493f2-4a97-11ee-9720-3b85166b6faf">
                                                                                        <ul class="nav__main ready nav--uppercase" data-v-6384e47a="" style="text-align: center; --nav-color-link: var(--color-white); --nav-color-underline: var(--color-white);">
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 500; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/minor-home-repairs.html"> Minor Home Repairs </a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 600; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/computer-tech-services.html"> Computer Tech Services </a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 600; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/electrical-help.html"> Electrical help </a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 600; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/wall-mounting.html"> Wall Mounting </a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 600; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/furniture-fixes-assembly.html"> Furniture Fixes &amp; Assembly </a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 600; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/plumbing-help.html"> Plumbing help </a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                            <li class="text-component nav__item 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 600; color: rgb(255, 255, 255); padding-left: 0.01em;'>
                                                                                                <a allow-nav="" class="" data-v-6384e47a="" href="/booktomnyc/s/appointments"> Book </a>
                                                                                                <div class="nav__subnav nav__subnav--dropdown dropdown__subnav--wrapper square__navigation-desktop_subnavDropdown--3onPj" data-v-23ca0682="" data-v-6384e47a="" style="margin-top: 15.7px; background: rgb(0, 0, 0); --nav-color-link: var(--color-white); --nav-color-underline: var(--color-white);">
                                                                                                    <ul class="w-background-dark" data-v-23ca0682="">
                                                                                                        <li class="nav__item" data-v-23ca0682="">
                                                                                                            <a allow-nav="" class="" data-v-23ca0682="" href="/booktomnyc/s/appointments"> Book </a>
                                                                                                        </li>
                                                                                                    </ul>
                                                                                                </div>
                                                                                            </li>
                                                                                            <li class="text-component nav__item nav__more-link 📚19-4-0uGevg 📚19-4-0EEwzY square__navigation-desktop_desktopNavItem--12r0w" data-v-54fd6eb4="" data-v-6384e47a="" style='line-height: 1.1; letter-spacing: 0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 500; color: rgb(255, 255, 255); padding-left: 0.01em; display: none;'>
                                                                                                <a data-v-6384e47a="" href="#">More</a>
                                                                                                <!-- -->
                                                                                            </li>
                                                                                        </ul>
                                                                                        <!-- -->
                                                                                    </nav>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <!-- -->
                                                                </div>
                                                                <!-- -->
                                                                <!-- -->
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <!-- -->
                                            </div>
                                            <!-- -->
                                            <!-- -->
                                            <div class="w-cell user-content row main-content-wrapper" data-v-5b51b8b9="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="">
                                                <div class="w-container col" data-v-5b51b8b9="" data-v-614c05a6="" data-v-6bcfc41e="">
                                                    <div class="w-cell row" data-v-5b51b8b9="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="">
                                                        <div class="w-block-wrapper" data-block-purpose="featured-categories@^1.0.0" data-v-301e84c2="" data-v-5b51b8b9="" id="mPUTGp" type="block">
                                                            <div class="📚19-4-0rI2oH" data-v-301e84c2="" style='--maker-color-neutral-0: #343b42; --maker-color-neutral-10: #5d6368; --maker-color-neutral-20: #797e83; --maker-color-neutral-80: #9da1a5; --maker-color-neutral-90: #f4f4f5; --maker-color-neutral-100: #ffffff; --maker-color-primary: #212121; --maker-color-background: #343b42; --maker-color-heading: #ffffff; --maker-color-body: #ffffff; --maker-color-elevation: #797e83; --maker-color-overlay: rgba(255, 255, 255, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px; background: none;'>
                                                                <div class="gallery-fullbleed w-block w-background-dark" colorprofile="custom-profile" data-v-1170136a="" data-v-20b0e156="" data-v-301e84c2="" data-v-fdc447e4="" elements="" isdark="true" layout="featured-categories-fullbleed-overlay" shortid="mPUTGp" style="background-color: var(--gray-dark); --text-color: #ffffff; --text-color-10: #494f55; --text-color-20: #5d6368; --text-color-30: #71767b; --text-color-40: #868a8e; --text-color-50: #9a9da1; --text-color-60: #aeb1b4; --text-color-70: #c3c5c7; --text-color-80: #d7d8da; --text-color-90: #ebeced; --text-color-alpha-10: rgba(255, 255, 255, 0.1);" textalign="">
                                                                    <div class="container container--flush-horizontal content-align--center" data-v-20b0e156="" style="text-align: center;">
                                                                        <div class="w-container col" data-v-614c05a6="" data-v-fdc447e4="">
                                                                            <div class="w-container section-details row" data-v-614c05a6="" data-v-f0e6268a="" data-v-fdc447e4="">
                                                                                <div class="w-cell section-details-text col offset-0 offset-sm-0 offset-md-0 offset-lg-0 offset-xl-0" data-v-614c05a6="" data-v-6bcfc41e="" data-v-f0e6268a="">
                                                                                    <div class="w-cell row row--inset" data-v-6bcfc41e="" data-v-6bda7270="" data-v-f0e6268a="">
                                                                                        <div class="w-wrapper" data-v-6bcfc41e="" data-v-ab1ca44a="" data-v-f0e6268a="">
                                                                                            <div class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l w-text--rendered" data-v-54fd6eb4="" data-v-7df72e6e="" data-v-ab1ca44a="" data-v-f0e6268a="" style='line-height: 1.1; letter-spacing: -0.01em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 300; color: rgb(255, 255, 255); text-transform: uppercase; --inline-link-color: var(--color-white);'>
                                                                                                <h3>Service Request Category</h3>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <!-- -->
                                                                                </div>
                                                                                <!-- -->
                                                                            </div>
                                                                            <div class="w-cell featured-categories-content row" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" data-v-fdc447e4="">
                                                                                <div class="gallery-fullbleed-grid-row" data-v-6bcfc41e="" data-v-fdc447e4="">
                                                                                    <div class="w-grid visible align--centered" data-v-41f3fba4="" data-v-6bcfc41e="" data-v-fdc447e4="" style="--grid-columns-xs: 1; --grid-columns-sm: 3; --grid-columns-md: 3; --grid-columns-lg: 3; --grid-column-gap-xs: calc(var(--gutter-column) * 0.125); --grid-column-gap-sm: calc(var(--gutter-column) * 0.125); --grid-column-gap-md: calc(var(--gutter-column) * 0.125); --grid-column-gap-lg: calc(var(--gutter-column) * 0.125); --grid-column-gap-xl: calc(var(--gutter-column) * 0.125); --grid-row-gap-xs: calc(var(--gutter-column) * 0.125); --grid-row-gap-sm: calc(var(--gutter-column) * 0.125); --grid-row-gap-md: calc(var(--gutter-column) * 0.125); --grid-row-gap-lg: calc(var(--gutter-column) * 0.125); --grid-row-gap-xl: calc(var(--gutter-column) * 0.125);">
                                                                                        <div class="grid__item" data-v-41f3fba4="">
                                                                                            <div class="category-item category-item__overlay" data-v-41f3fba4="" data-v-fdc447e4="">
                                                                                                <div class="w-wrapper" data-v-41f3fba4="" data-v-608c8c16="" data-v-ab1ca44a="" data-v-fdc447e4="">
                                                                                                    <div class="w-wrapper" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                        <div class="featured-category__image" data-v-0fe68b68="" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                            <div class="figure__aspect-ratio figure__aspect-ratio--4_3 figure__hover-effect--fade" data-v-0fe68b68="">
                                                                                                                <div class="figure__image has-cursor" data-v-0fe68b68="">
                                                                                                                    <div class="📚19-4-0emJCV" data-v-0fe68b68="">
                                                                                                                        <!-- -->
                                                                                                                        <img alt="Minor Home Repairs" class="📚19-4-0j_xX0" sizes="(max-width: 599px) 320px,(max-width: 839px) 640px,(max-width: 1199px) 1280px,(max-width: 1599px) 1280px,1280px" src="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c10_i5_w1024.jpeg?width=2400&amp;optimize=medium" srcset="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c10_i5_w1024.jpeg?width=40&amp;dpr=1 40w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c10_i5_w1024.jpeg?width=80&amp;dpr=1 80w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c10_i5_w1024.jpeg?width=160&amp;dpr=1 160w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c10_i5_w1024.jpeg?width=320&amp;dpr=1 320w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c10_i5_w1024.jpeg?width=640&amp;dpr=1 640w" style="--image-height: 479px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                                        <!-- -->
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div class="category-image__overlay-fill" data-v-0fe68b68="" style="display: none;"></div>
                                                                                                                <div class="category-image__overlay-container overlay--position-center" data-v-0fe68b68="" data-v-1d7e0cdc="" should-improve-readability="true">
                                                                                                                    <div class="overlay-title" data-v-1d7e0cdc="">
                                                                                                                        <div class="w-wrapper" data-v-1d7e0cdc="" data-v-ab1ca44a="">
                                                                                                                            <h3 class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l" data-v-1d7e0cdc="" data-v-54fd6eb4="" data-v-ab1ca44a="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); padding-left: 0em;'>
                                                                                                                                <a href="/booktomnyc/minor-home-repairs.html">Minor Home Repairs</a>
                                                                                                                            </h3>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                                <div class="hover__background figure__hover hover__background--fade" data-v-0fe68b68="" data-v-4af2756b="">
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </div>
                                                                                        <div class="grid__item" data-v-41f3fba4="">
                                                                                            <div class="category-item category-item__overlay" data-v-41f3fba4="" data-v-fdc447e4="">
                                                                                                <div class="w-wrapper" data-v-41f3fba4="" data-v-608c8c16="" data-v-ab1ca44a="" data-v-fdc447e4="">
                                                                                                    <div class="w-wrapper" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                        <div class="featured-category__image" data-v-0fe68b68="" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                            <div class="figure__aspect-ratio figure__aspect-ratio--4_3 figure__hover-effect--fade" data-v-0fe68b68="">
                                                                                                                <div class="figure__image has-cursor" data-v-0fe68b68="">
                                                                                                                    <div class="📚19-4-0emJCV" data-v-0fe68b68="">
                                                                                                                        <!-- -->
                                                                                                                        <img alt="Wall Mounting" class="📚19-4-0j_xX0" sizes="(max-width: 599px) 320px,(max-width: 839px) 640px,(max-width: 1199px) 1280px,(max-width: 1599px) 1280px,1280px" src="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c13_i3_w1024.jpeg?width=2400&amp;optimize=medium" srcset="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c13_i3_w1024.jpeg?width=40&amp;dpr=1 40w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c13_i3_w1024.jpeg?width=80&amp;dpr=1 80w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c13_i3_w1024.jpeg?width=160&amp;dpr=1 160w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c13_i3_w1024.jpeg?width=320&amp;dpr=1 320w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c13_i3_w1024.jpeg?width=640&amp;dpr=1 640w" style="--image-height: 479px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                                        <!-- -->
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div class="category-image__overlay-fill" data-v-0fe68b68="" style="display: none;"></div>
                                                                                                                <div class="category-image__overlay-container overlay--position-center" data-v-0fe68b68="" data-v-1d7e0cdc="" should-improve-readability="true">
                                                                                                                    <div class="overlay-title" data-v-1d7e0cdc="">
                                                                                                                        <div class="w-wrapper" data-v-1d7e0cdc="" data-v-ab1ca44a="">
                                                                                                                            <h3 class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l" data-v-1d7e0cdc="" data-v-54fd6eb4="" data-v-ab1ca44a="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); padding-left: 0em;'>
                                                                                                                                <a href="/booktomnyc/wall-mounting.html">Wall Mounting</a>
                                                                                                                            </h3>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                                <div class="hover__background figure__hover hover__background--fade" data-v-0fe68b68="" data-v-4af2756b="">
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </div>
                                                                                        <div class="grid__item" data-v-41f3fba4="">
                                                                                            <div class="category-item category-item__overlay" data-v-41f3fba4="" data-v-fdc447e4="">
                                                                                                <div class="w-wrapper" data-v-41f3fba4="" data-v-608c8c16="" data-v-ab1ca44a="" data-v-fdc447e4="">
                                                                                                    <div class="w-wrapper" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                        <div class="featured-category__image" data-v-0fe68b68="" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                            <div class="figure__aspect-ratio figure__aspect-ratio--4_3 figure__hover-effect--fade" data-v-0fe68b68="">
                                                                                                                <div class="figure__image has-cursor" data-v-0fe68b68="">
                                                                                                                    <div class="📚19-4-0emJCV" data-v-0fe68b68="">
                                                                                                                        <!-- -->
                                                                                                                        <img alt="Computer Tech Services" class="📚19-4-0j_xX0" sizes="(max-width: 599px) 320px,(max-width: 839px) 640px,(max-width: 1199px) 1280px,(max-width: 1599px) 1280px,1280px" src="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c14_i1_w1024.jpeg?width=2400&amp;optimize=medium" srcset="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c14_i1_w1024.jpeg?width=40&amp;dpr=1 40w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c14_i1_w1024.jpeg?width=80&amp;dpr=1 80w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c14_i1_w1024.jpeg?width=160&amp;dpr=1 160w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c14_i1_w1024.jpeg?width=320&amp;dpr=1 320w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c14_i1_w1024.jpeg?width=640&amp;dpr=1 640w" style="--image-height: 479px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                                        <!-- -->
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div class="category-image__overlay-fill" data-v-0fe68b68="" style="display: none;"></div>
                                                                                                                <div class="category-image__overlay-container overlay--position-center" data-v-0fe68b68="" data-v-1d7e0cdc="" should-improve-readability="true">
                                                                                                                    <div class="overlay-title" data-v-1d7e0cdc="">
                                                                                                                        <div class="w-wrapper" data-v-1d7e0cdc="" data-v-ab1ca44a="">
                                                                                                                            <h3 class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l" data-v-1d7e0cdc="" data-v-54fd6eb4="" data-v-ab1ca44a="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); padding-left: 0em;'>
                                                                                                                                <a href="/booktomnyc/computer-tech-services.html">Computer Tech Services</a>
                                                                                                                            </h3>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                                <div class="hover__background figure__hover hover__background--fade" data-v-0fe68b68="" data-v-4af2756b="">
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <div class="gallery-fullbleed-grid-row" data-v-6bcfc41e="" data-v-fdc447e4="">
                                                                                    <div class="w-grid visible align--centered" data-v-41f3fba4="" data-v-6bcfc41e="" data-v-fdc447e4="" style="--grid-columns-xs: 1; --grid-columns-sm: 3; --grid-columns-md: 3; --grid-columns-lg: 3; --grid-column-gap-xs: calc(var(--gutter-column) * 0.125); --grid-column-gap-sm: calc(var(--gutter-column) * 0.125); --grid-column-gap-md: calc(var(--gutter-column) * 0.125); --grid-column-gap-lg: calc(var(--gutter-column) * 0.125); --grid-column-gap-xl: calc(var(--gutter-column) * 0.125); --grid-row-gap-xs: calc(var(--gutter-column) * 0.125); --grid-row-gap-sm: calc(var(--gutter-column) * 0.125); --grid-row-gap-md: calc(var(--gutter-column) * 0.125); --grid-row-gap-lg: calc(var(--gutter-column) * 0.125); --grid-row-gap-xl: calc(var(--gutter-column) * 0.125);">
                                                                                        <div class="grid__item" data-v-41f3fba4="">
                                                                                            <div class="category-item category-item__overlay" data-v-41f3fba4="" data-v-fdc447e4="">
                                                                                                <div class="w-wrapper" data-v-41f3fba4="" data-v-608c8c16="" data-v-ab1ca44a="" data-v-fdc447e4="">
                                                                                                    <div class="w-wrapper" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                        <div class="featured-category__image" data-v-0fe68b68="" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                            <div class="figure__aspect-ratio figure__aspect-ratio--4_3 figure__hover-effect--fade" data-v-0fe68b68="">
                                                                                                                <div class="figure__image has-cursor" data-v-0fe68b68="">
                                                                                                                    <div class="📚19-4-0emJCV" data-v-0fe68b68="">
                                                                                                                        <!-- -->
                                                                                                                        <img alt="Electrical help" class="📚19-4-0j_xX0" sizes="(max-width: 599px) 320px,(max-width: 839px) 640px,(max-width: 1199px) 1280px,(max-width: 1599px) 1280px,1280px" src="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c15_i1_w1024.jpeg?width=2400&amp;optimize=medium" srcset="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c15_i1_w1024.jpeg?width=40&amp;dpr=1 40w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c15_i1_w1024.jpeg?width=80&amp;dpr=1 80w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c15_i1_w1024.jpeg?width=160&amp;dpr=1 160w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c15_i1_w1024.jpeg?width=320&amp;dpr=1 320w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c15_i1_w1024.jpeg?width=640&amp;dpr=1 640w" style="--image-height: 479px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                                        <!-- -->
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div class="category-image__overlay-fill" data-v-0fe68b68="" style="display: block;"></div>
                                                                                                                <div class="category-image__overlay-container overlay--position-center" data-v-0fe68b68="" data-v-1d7e0cdc="" should-improve-readability="true">
                                                                                                                    <div class="overlay-title" data-v-1d7e0cdc="">
                                                                                                                        <div class="w-wrapper" data-v-1d7e0cdc="" data-v-ab1ca44a="">
                                                                                                                            <h3 class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l" data-v-1d7e0cdc="" data-v-54fd6eb4="" data-v-ab1ca44a="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); padding-left: 0em;'>
                                                                                                                                <a href="/booktomnyc/electrical-help.html">Electrical help</a>
                                                                                                                            </h3>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                                <div class="hover__background figure__hover hover__background--fade" data-v-0fe68b68="" data-v-4af2756b="">
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </div>
                                                                                        <div class="grid__item" data-v-41f3fba4="">
                                                                                            <div class="category-item category-item__overlay" data-v-41f3fba4="" data-v-fdc447e4="">
                                                                                                <div class="w-wrapper" data-v-41f3fba4="" data-v-608c8c16="" data-v-ab1ca44a="" data-v-fdc447e4="">
                                                                                                    <div class="w-wrapper" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                        <div class="featured-category__image" data-v-0fe68b68="" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                            <div class="figure__aspect-ratio figure__aspect-ratio--4_3 figure__hover-effect--fade" data-v-0fe68b68="">
                                                                                                                <div class="figure__image has-cursor" data-v-0fe68b68="">
                                                                                                                    <div class="📚19-4-0emJCV" data-v-0fe68b68="">
                                                                                                                        <!-- -->
                                                                                                                        <img alt="Furniture Fixes &amp; Assembly" class="📚19-4-0j_xX0" sizes="(max-width: 599px) 320px,(max-width: 839px) 640px,(max-width: 1199px) 1280px,(max-width: 1599px) 1280px,1280px" src="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c12_i2_w1024.jpeg?width=2400&amp;optimize=medium" srcset="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c12_i2_w1024.jpeg?width=40&amp;dpr=1 40w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c12_i2_w1024.jpeg?width=80&amp;dpr=1 80w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c12_i2_w1024.jpeg?width=160&amp;dpr=1 160w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c12_i2_w1024.jpeg?width=320&amp;dpr=1 320w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c12_i2_w1024.jpeg?width=640&amp;dpr=1 640w" style="--image-height: 479px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                                        <!-- -->
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div class="category-image__overlay-fill" data-v-0fe68b68="" style="display: none;"></div>
                                                                                                                <div class="category-image__overlay-container overlay--position-center" data-v-0fe68b68="" data-v-1d7e0cdc="" should-improve-readability="true">
                                                                                                                    <div class="overlay-title" data-v-1d7e0cdc="">
                                                                                                                        <div class="w-wrapper" data-v-1d7e0cdc="" data-v-ab1ca44a="">
                                                                                                                            <h3 class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l" data-v-1d7e0cdc="" data-v-54fd6eb4="" data-v-ab1ca44a="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); padding-left: 0em;'>
                                                                                                                                <a href="/booktomnyc/furniture-fixes-assembly.html">Furniture Fixes +</a>
                                                                                                                            </h3>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                                <div class="hover__background figure__hover hover__background--fade" data-v-0fe68b68="" data-v-4af2756b="">
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </div>
                                                                                        <div class="grid__item" data-v-41f3fba4="">
                                                                                            <div class="category-item category-item__overlay" data-v-41f3fba4="" data-v-fdc447e4="">
                                                                                                <div class="w-wrapper" data-v-41f3fba4="" data-v-608c8c16="" data-v-ab1ca44a="" data-v-fdc447e4="">
                                                                                                    <div class="w-wrapper" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                        <div class="featured-category__image" data-v-0fe68b68="" data-v-608c8c16="" data-v-ab1ca44a="">
                                                                                                            <div class="figure__aspect-ratio figure__aspect-ratio--4_3 figure__hover-effect--fade" data-v-0fe68b68="">
                                                                                                                <div class="figure__image has-cursor" data-v-0fe68b68="">
                                                                                                                    <div class="📚19-4-0emJCV" data-v-0fe68b68="">
                                                                                                                        <!-- -->
                                                                                                                        <img alt="Plumbing help" class="📚19-4-0j_xX0" sizes="(max-width: 599px) 320px,(max-width: 839px) 640px,(max-width: 1199px) 1280px,(max-width: 1599px) 1280px,1280px" src="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c11_i2_w1024.jpeg?width=2400&amp;optimize=medium" srcset="https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c11_i2_w1024.jpeg?width=40&amp;dpr=1 40w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c11_i2_w1024.jpeg?width=80&amp;dpr=1 80w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c11_i2_w1024.jpeg?width=160&amp;dpr=1 160w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c11_i2_w1024.jpeg?width=320&amp;dpr=1 320w, https://146881549.cdn6.editmysite.com/uploads/1/4/6/8/146881549/s674486197457615854_c11_i2_w1024.jpeg?width=640&amp;dpr=1 640w" style="--image-height: 479px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                                        <!-- -->
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div class="category-image__overlay-fill" data-v-0fe68b68="" style="display: none;"></div>
                                                                                                                <div class="category-image__overlay-container overlay--position-center" data-v-0fe68b68="" data-v-1d7e0cdc="" should-improve-readability="true">
                                                                                                                    <div class="overlay-title" data-v-1d7e0cdc="">
                                                                                                                        <div class="w-wrapper" data-v-1d7e0cdc="" data-v-ab1ca44a="">
                                                                                                                            <h3 class="text-component 📚19-4-0uGevg 📚19-4-0NNp1l" data-v-1d7e0cdc="" data-v-54fd6eb4="" data-v-ab1ca44a="" style='line-height: 1.3; letter-spacing: 0em; --mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255); padding-left: 0em;'>
                                                                                                                                <a href="/booktomnyc/plumbing-help.html">Plumbing help</a>
                                                                                                                            </h3>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                                <div class="hover__background figure__hover hover__background--fade" data-v-0fe68b68="" data-v-4af2756b="">
                                                                                                                    <!-- -->
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <!-- -->
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <!-- -->
                                            <div class="w-cell row" data-v-5b51b8b9="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="">
                                                <div class="w-block-wrapper" data-block-purpose="footer" data-v-301e84c2="" data-v-5b51b8b9="" id="rSiecF" type="block">
                                                    <div class="📚19-4-0rI2oH" data-v-301e84c2="" style='--maker-color-neutral-0: #212121; --maker-color-neutral-10: #4c4c4c; --maker-color-neutral-20: #6b6b6b; --maker-color-neutral-80: #929292; --maker-color-neutral-90: #f2f2f2; --maker-color-neutral-100: #ffffff; --maker-color-primary: #212121; --maker-color-background: #212121; --maker-color-heading: #ffffff; --maker-color-body: #ffffff; --maker-color-elevation: #6b6b6b; --maker-color-overlay: rgba(255, 255, 255, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px; background: none;'>
                                                        <div class="w-block w-background-dark" colorprofile="primary-bold" data-v-1170136a="" data-v-20b0e156="" data-v-301e84c2="" data-v-f2727a24="" isdark="true" layout="footer-7" shortid="rSiecF" style="background-color: var(--primary-color); --text-color: #ffffff; --text-color-10: #383838; --text-color-20: #4e4e4e; --text-color-30: #646464; --text-color-40: #7a7a7a; --text-color-50: #909090; --text-color-60: #a7a7a7; --text-color-70: #bdbdbd; --text-color-80: #d3d3d3; --text-color-90: #e9e9e9; --text-color-alpha-10: rgba(255, 255, 255, 0.1);" textalign="">
                                                            <div class="container content-align--center" data-v-20b0e156="" style="text-align: left;">
                                                                <div class="w-container col" data-v-614c05a6="" data-v-f2727a24="">
                                                                    <div class="w-cell row" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" data-v-f2727a24="">
                                                                        <div class="w-container align-flex-end row" data-v-614c05a6="" data-v-6bcfc41e="" data-v-f2727a24="">
                                                                            <div class="w-cell col col-12 col-sm-6 align--center-xs align--left-sm align--left-md align--left-lg align--left-xl" data-v-614c05a6="" data-v-6bcfc41e="" data-v-f2727a24="" style="margin-bottom: calc(var(--gutter-row-sm) * 0);">
                                                                                <div class="w-container col" data-v-614c05a6="" data-v-6bcfc41e="" data-v-f2727a24="">
                                                                                    <div class="w-cell row" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="" data-v-f2727a24="">
                                                                                        <div class="w-wrapper" data-v-6bcfc41e="" data-v-ab1ca44a="" data-v-f2727a24="">
                                                                                            <a button="[object Object]" class="logo__link router-link-exact-active router-link-active" data-v-6f51d002="" data-v-ab1ca44a="" data-v-f2727a24="" href="/booktomnyc/" id="2a810640-4a97-11ee-9720-3b85166b6faf" name="Untitled_Project__12_-...iew.png" original="/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png" style="text-align: inherit;">
                                                                                                <span class="w-sitelogo" data-v-23d6841e="" data-v-6f51d002="" data-wg-notranslate="" style="text-align: inherit;">
                                                                                                    <div class="📚19-4-0emJCV" data-v-23d6841e="" style="--width: 315.7291666666667px; --mobile-width: 150.34722222222223px;">
                                                                                                        <!-- -->
                                                                                                        <img alt="BookTomNYC logo" class="📚19-4-0j_xX0 📚19-4-0NojeF" sizes="(min-width: 600px) 315.7291666666667px, 150.34722222222223px" src="https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=2400&amp;optimize=medium" srcset="https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=400&amp;optimize=medium 400w, https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=800&amp;optimize=medium 800w, https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=1200&amp;optimize=medium 1200w, https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=1600&amp;optimize=medium 1600w, https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=2000&amp;optimize=medium 2000w, https://f282d25d20fbea34db41.cdn6.editmysite.com/uploads/b/f282d25d20fbea34db4151912e243e7f3f0cb05edbaf55dc449a929bd5189c16/Untitled_Project__12_-removebg-preview_1693805960.png?width=2400&amp;optimize=medium 2400w" style="--image-height: 105px; --image-object-fit: cover; --image-object-position: center; opacity: 1;" />
                                                                                                        <!-- -->
                                                                                                    </div>
                                                                                                </span>
                                                                                            </a>
                                                                                        </div>
                                                                                    </div>
                                                                                    <!-- -->
                                                                                </div>
                                                                            </div>
                                                                            <!-- -->
                                                                        </div>
                                                                    </div>
                                                                    <!-- -->
                                                                    <!-- -->
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="w-cell row" data-v-5b51b8b9="" data-v-614c05a6="" data-v-6bcfc41e="" data-v-6bda7270="">
                                                <div class="w-block-wrapper" data-block-purpose="free-footer@^1.0.0" data-v-301e84c2="" data-v-5b51b8b9="" id="BFyYkq" type="block">
                                                    <div data-v-301e84c2="">
                                                        <div class="w-block w-background-dark" data-v-1170136a="" data-v-301e84c2="" data-v-c2ac550a="" id="2a1c29f4-4a97-11ee-9720-3b85166b6faf" isdark="true" layout="free-footer-1" shortid="BFyYkq" style="background-color: rgb(50, 59, 67); --text-color: #ffffff; --text-color-10: #474f56; --text-color-20: #5b6369; --text-color-30: #70767c; --text-color-40: #848a8f; --text-color-50: #999da1; --text-color-60: #adb1b4; --text-color-70: #c2c5c7; --text-color-80: #d6d8da; --text-color-90: #ebeced; --text-color-alpha-10: rgba(255, 255, 255, 0.1);"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <svg data-v-b0348236="" style="display: none;" xmlns="http://www.w3.org/2000/svg">
                                        <symbol fill="none" id="alert-triangle-icon" viewbox="0 0 16 16">
                                            <path clip-rule="evenodd" d="M.41 13.759 7.561.794a.5.5 0 0 1 .876 0l7.153 12.965a.5.5 0 0 1-.438.741H.847a.5.5 0 0 1-.438-.741zM8 9.002a1 1 0 0 1-1-1v-2a1 1 0 0 1 2 0v2a1 1 0 0 1-1 1zm0 1A1 1 0 1 0 8 12a1 1 0 0 0 0-2z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="email-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm3.5-3h9L8.707 8.793a1 1 0 0 1-1.414 0L3.5 5zM3 6l3.586 3.586a2 2 0 0 0 2.828 0L13 6v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="embed-code-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M0 0h22v12H0z" fill="var(--background-fill)" transform="translate(21 26)"></path>
                                            <path d="m36 38 7-6-7-6M28 26l-7 6 7 6" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                                        </symbol>
                                        <symbol fill="none" id="embed-pdf-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M29.677 32.716s-3.829 10.074-6.974 9.234c-3.145-.84 5.06-5.516 8.752-6.116 3.692-.6 10.939-3.358 10.528 0-.547 3.358-5.743-.6-8.75-4.557-3.009-3.958-4.24-9.834-1.778-9.235 2.46.6-.547 8.155-1.778 10.674z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"></path>
                                        </symbol>
                                        <symbol id="facebook-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8.567 4.437V8.085H9.77l.159-1.5h-1.36l.001-.75c0-.392.037-.602.6-.602h.75v-1.5H8.718c-1.444 0-1.952.728-1.952 1.952v.9h-.9v1.5h.9v4.352h1.801z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="google-plus-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8c0-4.418 3.528-8 7.88-8s7.88 3.582 7.88 8-3.528 8-7.88 8S0 12.418 0 8zm6.438-.229v.869h1.42c-.057.373-.43 1.093-1.42 1.093-.855 0-1.552-.717-1.552-1.6 0-.883.697-1.6 1.552-1.6.487 0 .812.21.998.392l.68-.663A2.385 2.385 0 0 0 6.438 5.6c-1.384 0-2.504 1.133-2.504 2.533s1.12 2.534 2.504 2.534c1.445 0 2.404-1.028 2.404-2.476 0-.166-.018-.293-.04-.42H6.438zm5.365 0h-.715v-.723h-.715v.723h-.716v.724h.716v.724h.715v-.724h.715v-.724z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="instagram-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <g fill-rule="evenodd" style="fill:var(--icon-fill)">
                                                <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-4.267c-1.158 0-1.304.005-1.759.026a3.12 3.12 0 0 0-1.035.198 2.09 2.09 0 0 0-.756.492 2.095 2.095 0 0 0-.493.756c-.106.271-.178.582-.198 1.036-.02.455-.026.6-.026 1.759 0 1.159.005 1.304.026 1.759.021.454.093.764.198 1.035.11.281.255.52.492.756.237.238.476.384.756.493.271.105.582.177 1.036.198.455.02.6.026 1.759.026 1.159 0 1.304-.005 1.759-.026.454-.02.764-.093 1.036-.198.28-.11.518-.255.755-.493.238-.237.383-.475.493-.755.105-.272.177-.582.198-1.036.02-.455.026-.6.026-1.759 0-1.159-.006-1.304-.026-1.76-.021-.453-.093-.764-.198-1.035a2.094 2.094 0 0 0-.493-.756 2.085 2.085 0 0 0-.755-.492c-.272-.105-.583-.177-1.037-.198-.455-.02-.6-.026-1.759-.026H8z"></path>
                                                <path d="M7.618 4.502H8c1.14 0 1.275.004 1.725.025.416.019.641.088.792.147.199.077.34.17.49.319.15.15.242.291.32.49.058.15.127.376.146.792.02.45.025.585.025 1.724s-.004 1.274-.025 1.724c-.019.416-.088.641-.147.792-.077.199-.17.34-.319.49a1.32 1.32 0 0 1-.49.319c-.15.059-.376.128-.792.147-.45.02-.585.025-1.725.025-1.139 0-1.274-.005-1.724-.025-.416-.02-.641-.089-.792-.147-.2-.078-.341-.17-.49-.32a1.322 1.322 0 0 1-.32-.49c-.058-.15-.128-.376-.147-.792-.02-.45-.024-.585-.024-1.724 0-1.14.004-1.274.024-1.724.02-.416.089-.641.147-.792.077-.199.17-.341.32-.49.149-.15.29-.242.49-.32.15-.058.376-.128.792-.147.394-.018.546-.023 1.342-.024v.001zm2.66.709a.512.512 0 1 0 0 1.024.512.512 0 0 0 0-1.024zM8 5.809a2.191 2.191 0 1 0 0 4.382A2.191 2.191 0 0 0 8 5.81z"></path>
                                                <path d="M8 6.578a1.422 1.422 0 1 1 0 2.844 1.422 1.422 0 0 1 0-2.844z"></path>
                                            </g>
                                        </symbol>
                                        <symbol fill="none" id="instagram-item-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M0 0h24v24H0z" fill="var(--background-fill)" transform="translate(20 20)"></path>
                                            <rect height="22" rx="5" stroke="var(--icon-fill)" stroke-width="2" width="22" x="21" y="21"></rect>
                                            <circle cx="32" cy="32" r="5" stroke="var(--icon-fill)" stroke-width="2"></circle>
                                            <circle cx="39" cy="26" fill="var(--icon-fill)" r="1"></circle>
                                        </symbol>
                                        <svg fill="none" height="24" id="tiktok-icon" width="24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 23c6.075 0 11-4.925 11-11S18.075 1 12 1 1 5.925 1 12s4.925 11 11 11z" fill="#fff" style="fill:var(--background-fill)"></path>
                                            <path clip-rule="evenodd" d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12zm1.595-18.996c-.43 0-.86.001-1.292.008a552.03 552.03 0 0 0-.01 4.496 981.783 981.783 0 0 1-.002 3.392c.001.76.002 1.518-.04 2.279-.005.21-.11.396-.211.577l-.024.043c-.335.553-.951.931-1.594.938-.97.087-1.878-.717-2.014-1.675a11.238 11.238 0 0 0-.005-.141c-.01-.27-.019-.545.083-.797.144-.418.42-.777.785-1.02.499-.352 1.166-.404 1.737-.217 0-.37.007-.738.013-1.107.008-.495.016-.99.01-1.484-1.25-.238-2.585.163-3.538 1.004a4.392 4.392 0 0 0-1.487 2.894c-.01.29-.008.58.007.868.12 1.365.937 2.637 2.1 3.332.701.42 1.524.647 2.347.599 1.342-.023 2.648-.752 3.401-1.87a4.48 4.48 0 0 0 .778-2.3 301.8 301.8 0 0 0 .01-3.365l.001-1.74c.3.199.605.393.933.543.753.363 1.587.538 2.417.565V8.477c-.886-.1-1.796-.396-2.44-1.043-.645-.632-.961-1.541-1.007-2.434-.319.003-.638.003-.958.004z" fill="#000" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </svg>
                                        <symbol id="linkedin-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm5.654-1.374H3.84v5.447h1.813V6.626zm.119-1.685C5.76 4.407 5.379 4 4.759 4s-1.026.407-1.026.94c0 .524.394.942 1.002.942h.012c.632 0 1.026-.418 1.026-.941zm6.419 4.009c0-1.673-.895-2.452-2.088-2.452-.962 0-1.393.529-1.634.9v-.772H6.657c.024.511 0 5.447 0 5.447H8.47V9.031c0-.163.012-.325.06-.442.131-.325.43-.662.93-.662.656 0 .919.5.919 1.232v2.914h1.813V8.95z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="twitter-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.76-1.497.017.276-.28-.034c-1.018-.13-1.908-.57-2.663-1.31l-.37-.367-.095.27c-.201.605-.072 1.244.347 1.673.224.237.174.271-.212.13-.135-.045-.252-.08-.263-.062-.04.04.095.553.201.757.146.282.442.559.767.723l.274.13-.325.005c-.313 0-.324.006-.29.125.111.367.553.757 1.046.926l.347.119-.302.18a3.15 3.15 0 0 1-1.5.419c-.252.005-.459.028-.459.045 0 .056.683.373 1.08.497 1.192.367 2.608.21 3.67-.418.756-.446 1.512-1.333 1.864-2.192.19-.458.38-1.294.38-1.695 0-.26.018-.294.33-.604.186-.181.36-.379.393-.435.056-.108.05-.108-.235-.012-.476.17-.543.147-.308-.107.173-.18.38-.508.38-.604 0-.017-.084.01-.179.062-.1.056-.324.141-.492.192l-.302.096-.274-.187a2.278 2.278 0 0 0-.476-.248 1.909 1.909 0 0 0-.98.022c-.699.255-1.141.91-1.09 1.628z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="vimeo-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm12.529-1.546c.057-1.25-.409-1.89-1.395-1.919-1.33-.043-2.232.708-2.704 2.253a1.8 1.8 0 0 1 .71-.158c.49 0 .705.275.647.823-.029.331-.244.814-.646 1.449-.403.635-.705.952-.905.952-.259 0-.496-.489-.712-1.467-.072-.287-.201-1.02-.388-2.2-.172-1.093-.632-1.604-1.38-1.532-.315.03-.79.316-1.422.862-.46.417-.927.833-1.4 1.25l.45.581c.431-.3.682-.452.754-.452.33 0 .638.517.925 1.55l.775 2.84c.387 1.034.86 1.55 1.42 1.55.903 0 2.008-.848 3.313-2.544 1.262-1.624 1.915-2.904 1.958-3.838z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="video-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M28 40V25l11 7.5L28 40z" fill="var(--icon-fill)" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                                        </symbol>
                                        <symbol id="youtube-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8c0-4.418 3.528-8 7.88-8s7.88 3.582 7.88 8-3.528 8-7.88 8S0 12.418 0 8zm11.982-1.61s-.082-.601-.334-.866c-.32-.347-.677-.349-.84-.369-1.175-.088-2.937-.088-2.937-.088h-.004s-1.762 0-2.936.088c-.165.02-.522.022-.842.37-.251.264-.333.865-.333.865s-.084.705-.084 1.411v.662c0 .705.084 1.411.084 1.411s.082.6.333.865c.32.348.74.337.926.373.672.067 2.854.088 2.854.088s1.764-.003 2.938-.091c.164-.02.522-.022.841-.37.252-.264.334-.865.334-.865s.084-.706.084-1.411V7.8c0-.706-.084-1.411-.084-1.411zm-4.98 2.874v-2.45l2.268 1.23-2.268 1.22z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="pinterest-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm-2.63-1.07h.47c.3-.49.74-1.28.9-1.9l.46-1.73c.23.45.92.83 1.66.83 2.18 0 3.76-2 3.76-4.5 0-2.4-1.95-4.2-4.47-4.2-3.13 0-4.79 2.1-4.79 4.4 0 1.06.57 2.38 1.47 2.8.14.07.21.04.24-.1l.2-.81a.22.22 0 0 0-.04-.21 2.82 2.82 0 0 1-.54-1.66c0-1.6 1.2-3.14 3.27-3.14 1.78 0 3.03 1.2 3.03 2.95 0 1.96-1 3.32-2.28 3.32-.71 0-1.25-.6-1.08-1.31.21-.87.6-1.8.6-2.42 0-.56-.3-1.02-.91-1.02-.73 0-1.31.75-1.31 1.76 0 .64.21 1.08.21 1.08l-.85 3.6a8.15 8.15 0 0 0 0 2.26z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="snapchat-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8c0-4.42 3.53-8 7.88-8a7.94 7.94 0 0 1 7.88 8c0 4.42-3.53 8-7.88 8A7.94 7.94 0 0 1 0 8zm7.95-4h-.17c-.18 0-.55.03-.96.2A2.14 2.14 0 0 0 5.7 5.37c-.19.43-.14 1.15-.1 1.73v.19a.32.32 0 0 1-.13.02.9.9 0 0 1-.38-.1.33.33 0 0 0-.14-.03.5.5 0 0 0-.25.07.35.35 0 0 0-.18.23c0 .06 0 .18.12.3a.9.9 0 0 0 .31.18l.13.05c.15.05.39.12.45.27.03.07.02.17-.04.29a2.82 2.82 0 0 1-.94 1.13c-.22.15-.46.24-.71.28a.2.2 0 0 0-.17.21l.02.09c.04.1.14.17.29.25.18.08.46.16.82.21l.05.19.05.2c.02.07.08.16.22.16.06 0 .12 0 .2-.02a2.15 2.15 0 0 1 .75-.03c.2.04.38.16.59.31a1.89 1.89 0 0 0 1.26.46c.52 0 .86-.24 1.16-.46.2-.15.38-.27.59-.3a1.9 1.9 0 0 1 .75.01l.2.03c.11 0 .2-.06.22-.17l.05-.2.05-.18c.36-.05.64-.13.82-.21.15-.08.24-.16.28-.25a.26.26 0 0 0 .03-.09.2.2 0 0 0-.17-.2c-1.12-.2-1.63-1.36-1.65-1.41v-.01c-.06-.12-.07-.22-.04-.3.06-.14.3-.21.45-.26l.12-.05a.94.94 0 0 0 .34-.2c.08-.09.1-.18.1-.23 0-.14-.1-.26-.27-.32a.48.48 0 0 0-.18-.03.4.4 0 0 0-.17.03.95.95 0 0 1-.35.1.31.31 0 0 1-.12-.02l.01-.17V7.1a4.3 4.3 0 0 0-.1-1.73 2.2 2.2 0 0 0-.52-.74 2.2 2.2 0 0 0-1.57-.62z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="yelp-icon" viewbox="0 0 22 23">
                                            <path clip-rule="evenodd" d="M11 .876c-6.001 0-11 4.999-11 11 0 6.002 4.999 11 11 11s11-4.998 11-11c0-6.001-4.999-11-11-11z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                            <path clip-rule="evenodd" d="M10.636 4.94a6.049 6.049 0 0 0-2.505.737c-.397.215-.444.455-.208.853.82 1.38 1.64 2.76 2.465 4.138.086.144.19.284.31.395.298.275.675.157.78-.245.033-.13.042-.268.05-.387l.01-.133-.09-1.421c-.071-1.137-.142-2.254-.215-3.37-.029-.443-.177-.593-.597-.566zm2.35 7.374a.766.766 0 0 0 .107-.018l.554-.146c.681-.18 1.362-.36 2.042-.546.38-.103.502-.332.364-.724a4.9 4.9 0 0 0-1.185-1.881c-.287-.283-.54-.251-.771.08-.36.51-.716 1.025-1.072 1.54-.18.261-.36.522-.542.783a.54.54 0 0 0-.039.587c.103.204.264.323.5.33l.042-.005zm-2.88-.142c.257.112.37.305.36.587-.012.267-.136.436-.403.526l-.215.073c-.785.266-1.57.532-2.356.79-.342.112-.557-.011-.634-.386-.089-.757-.035-1.824.054-2.242.098-.462.34-.577.752-.402.816.348 1.63.7 2.443 1.054zm5.752 2.243-.562-.2c-.697-.247-1.394-.495-2.092-.74-.215-.076-.402-.008-.545.175-.15.191-.216.414-.087.638.501.87 1.009 1.736 1.522 2.598.124.209.321.254.534.146a1.11 1.11 0 0 0 .253-.177 5.28 5.28 0 0 0 1.18-1.602c.039-.082.064-.171.09-.26l.036-.123c-.012-.242-.127-.383-.329-.454zm-4.691-.313c.223.094.326.258.327.538.002.338.002.677.001 1.016v.43h-.015v.436c.001.337.002.674-.002 1.011-.003.366-.18.561-.521.525a4.275 4.275 0 0 1-2.095-.815c-.285-.208-.308-.475-.087-.758.584-.748 1.174-1.49 1.766-2.23.166-.208.387-.254.626-.153z" fill-rule="evenodd" style="fill:var(--background-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="cash-app-logo-icon" viewbox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C20 4.56 20 6.24 20 9.6v.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C15.44 20 13.76 20 10.4 20h-.8c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 15.44 0 13.76 0 10.4v-.8z" fill="var(--color-cash-app)"></path>
                                            <path clip-rule="evenodd" d="M10.52 6.853c1.036 0 2.029.42 2.678.995.164.146.41.145.564-.01l.772-.784a.403.403 0 0 0-.02-.587 6.105 6.105 0 0 0-2.07-1.164l.243-1.153a.405.405 0 0 0-.396-.488H10.8a.405.405 0 0 0-.396.32l-.218 1.026c-1.983.1-3.665 1.089-3.665 3.12 0 1.758 1.391 2.511 2.86 3.033 1.39.521 2.124.715 2.124 1.449 0 .753-.733 1.197-1.816 1.197-.986 0-2.02-.325-2.821-1.116a.403.403 0 0 0-.566-.001l-.83.818a.407.407 0 0 0 .002.582c.647.628 1.467 1.082 2.401 1.337l-.227 1.068a.405.405 0 0 0 .393.49l1.494.01a.404.404 0 0 0 .399-.321l.216-1.027c2.375-.147 3.828-1.438 3.828-3.327 0-1.739-1.448-2.473-3.207-3.072-1.004-.367-1.874-.618-1.874-1.371 0-.734.812-1.024 1.623-1.024z" fill="#fff" fill-rule="evenodd"></path>
                                        </symbol>
                                        <symbol fill="none" id="square-pay-logo-icon" viewbox="0 0 52 19" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="19" width="52" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M14.159 0H2.84A2.84 2.84 0 0 0 0 2.84v11.318A2.842 2.842 0 0 0 2.841 17H14.16A2.842 2.842 0 0 0 17 14.158V2.84A2.84 2.84 0 0 0 14.159 0zm-.25 13.013a.896.896 0 0 1-.896.896H3.989a.897.897 0 0 1-.896-.896V3.988a.896.896 0 0 1 .896-.897h9.024a.897.897 0 0 1 .896.897v9.025z" fill="var(--icon-fill)"></path>
                                                <path d="M6.694 10.806a.514.514 0 0 1-.514-.516V6.687a.514.514 0 0 1 .514-.517h3.612a.515.515 0 0 1 .514.517v3.603a.516.516 0 0 1-.514.516H6.694z" fill="var(--icon-fill)"></path>
                                                <path d="M23.744 15.5v-4.716h2.178c2.934 0 4.59-1.35 4.59-3.942S28.856 2.9 25.922 2.9h-4.626v12.6h2.448zm0-10.548h2.25c1.26 0 2.088.648 2.088 1.89s-.828 1.89-2.088 1.89h-2.25v-3.78zM34.865 15.68c1.386 0 2.286-.648 2.736-1.728h.145V15.5h2.213V8.804c0-1.944-1.404-2.988-3.96-2.988-2.088 0-3.672 1.116-3.924 2.916h2.268c.162-.738.792-1.152 1.656-1.152.99 0 1.602.54 1.602 1.386v.846l-2.231.162c-2.197.162-3.492 1.152-3.492 2.952 0 1.62 1.206 2.754 2.987 2.754zm.756-1.728c-.846 0-1.35-.504-1.35-1.206 0-.72.505-1.206 1.512-1.278l1.819-.144v.396c0 1.332-.792 2.232-1.98 2.232zm8.382 4.932c1.764 0 2.754-.612 3.402-2.448l3.618-10.44h-2.232l-1.8 5.472-.342 1.332h-.144l-.324-1.332-1.836-5.472h-2.358l3.528 9.612-.18.504c-.234.594-.612.828-1.386.828h-1.332v1.944h1.386z" fill="var(--icon-fill)" fill-opacity=".95"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="close-icon" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <rect height="20.587" rx=".936" style="fill:var(--icon-fill)" transform="scale(.99243 1.00751) rotate(45 4.622 24.714)" width="1.872"></rect>
                                            <rect height="20.587" rx=".936" style="fill:var(--icon-fill)" transform="matrix(-.70176 .71242 .70176 .71242 5.313 4)" width="1.872"></rect>
                                        </symbol>
                                        <symbol fill="none" id="shopping-bag-icon" viewbox="0 0 33 33">
                                            <circle cx="16.5" cy="16.5" fill="var(--background-fill)" fill-opacity=".4" r="16.5"></circle>
                                            <path clip-rule="evenodd" d="M14.836 15a1 1 0 0 1-2 0h1-1v-.026l.001-.065a24.537 24.537 0 0 1 .054-1.273h-2.143L10 23.134h12.673l-.748-9.498h-2.143a29.311 29.311 0 0 1 .05 1.038l.004.236V14.998l-1 .001h1a1 1 0 0 1-2 0v-.067l-.004-.208a22.363 22.363 0 0 0-.055-1.089h-2.881a23.613 23.613 0 0 0-.059 1.297V15zm.305-3.364h2.391c-.15-.823-.359-1.56-.632-2.07-.287-.537-.493-.566-.563-.566-.071 0-.277.03-.564.566-.273.51-.483 1.246-.632 2.07zm4.42 0h2.364a2 2 0 0 1 1.994 1.843l.748 9.498a2 2 0 0 1-1.994 2.157H10a2 2 0 0 1-1.994-2.157l.748-9.498a2 2 0 0 1 1.994-1.843h2.364c.016-.103.034-.207.053-.312.162-.91.419-1.908.845-2.702C14.425 7.846 15.157 7 16.337 7c1.179 0 1.91.846 2.326 1.622.426.794.683 1.792.845 2.702.019.104.037.209.053.312z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                        </symbol>
                                        <symbol fill="none" id="ellipse-icon" viewbox="0 0 4 4" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="4" width="4" xmlns="http://www.w3.org/2000/svg">
                                                <circle cx="2" cy="2" fill="var(--icon-fill)" r="2"></circle>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="tag-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path clip-rule="evenodd" d="M15.707 5.107c.777-.776 2.05-1.564 3.488-2.158C20.63 2.356 22.122 2 23.3 2H34c2.188 0 4 1.691 4 3.9v10.7c0 1.166-.374 2.625-.992 4.052-.615 1.418-1.429 2.707-2.226 3.552l-8.05 8.114L7.615 13.2l8.092-8.093zM6.2 14.614l19.124 19.123-3.131 3.156-.001.001a3.889 3.889 0 0 1-5.485-.001l-.005-.006-.025-.025-.099-.1-.374-.377-1.352-1.363-4.23-4.264a4953.029 4953.029 0 0 0-7.515-7.565 3.889 3.889 0 0 1 0-5.486L6.2 14.614zm9.09 23.69L16 37.6l-.71.704-.002-.002-.007-.007-.025-.025-.098-.099-.374-.378-1.352-1.362-4.23-4.264a4998 4998 0 0 0-7.509-7.56 5.889 5.889 0 0 1 0-8.314l12.6-12.6c1.023-1.024 2.55-1.936 4.138-2.592C20.019.444 21.778 0 23.3 0H34c3.211 0 6 2.509 6 5.9v10.7c0 1.534-.477 3.275-1.158 4.848-.684 1.577-1.617 3.084-2.617 4.14l-.016.016-12.6 12.7-.003.003a5.889 5.889 0 0 1-8.314 0l-.003-.003zM35 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="digital-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M35 8h.974a.974.974 0 0 0-.285-.689l-.69.689zm-7-7 .689-.689a.974.974 0 0 0-.69-.285V1zm6 33.026H10v1.948h24v-1.948zm-24 0c-.042 0-.06-.007-.06-.007s.003 0 .008.004a.1.1 0 0 1 .03.03l.003.007s-.007-.018-.007-.06H8.026c0 .521.178 1.032.56 1.414.382.382.893.56 1.414.56v-1.948zM9.974 34V2H8.026v32h1.948zm0-32 .001-.011c-.001.003-.001.002.002-.002a.058.058 0 0 1 .018-.01c.007-.003.01-.003.005-.003V.026C9.026.026 8.026.8 8.026 2h1.948zm24.051 32v.011c0-.003.001-.002-.002.002a.06.06 0 0 1-.018.01c-.007.003-.01.003-.005.003v1.948c.974 0 1.974-.774 1.974-1.974h-1.949zm1.95 0V8h-1.95v26h1.95zm-.286-26.689-7-7-1.378 1.378 7 7 1.378-1.378zM27.999.026H10v1.948h18V.026z" fill="var(--icon-fill)"></path>
                                                <path d="M28 1v7h7" stroke="var(--icon-fill)" stroke-linejoin="round" stroke-width="1.949"></path>
                                                <path d="M31 37.998h.974a.974.974 0 0 1-.069.36l-.905-.36zM8.5 3.924a.974.974 0 1 1 0 1.949V3.924zM6 5.873a.18.18 0 0 0-.058.007l.007-.005a.1.1 0 0 0 .03-.029l.003-.006s-.007.02-.007.061h-1.95c0-.521.178-1.032.56-1.415.382-.383.893-.562 1.415-.562v1.949zm-.025.028v32.097h-1.95V5.901h1.95zm0 32.097v.012c0 .001 0 .001 0 0l.004.004a.06.06 0 0 0 .017.01c.007.003.009.003.004.003v1.948c-.976 0-1.974-.778-1.974-1.977h1.949zm.025.029h24v1.948H6v-1.948zm24 0c-.132 0-.2.056-.186.046a.657.657 0 0 0 .112-.131 1.808 1.808 0 0 0 .17-.31c.001 0 .001 0 0 0v.004c-.001 0-.001.001.904.362l.905.361v.002l-.002.002a.374.374 0 0 1-.002.006l-.007.017a2.646 2.646 0 0 1-.094.203 3.73 3.73 0 0 1-.276.468 2.54 2.54 0 0 1-.52.559 1.64 1.64 0 0 1-1.004.36v-1.95zm1-.029h-.974v-3.009h1.948v3.009H31zM6 3.924h2.5v1.949H6V3.924z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="service-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m15 8 .74.673a1 1 0 0 0-.033-1.38L15 8zM5 19l-.707.707a1 1 0 0 0 1.447-.034L5 19zm-3-3-.74-.673a1 1 0 0 0 .033 1.38L2 16zM12 5l.707-.707a1 1 0 0 0-1.447.034L12 5zm13 3-.707-.707a1 1 0 0 0-.033 1.38L25 8zm10 11-.74.673a1 1 0 0 0 1.447.034L35 19zm3-3 .707.707a1 1 0 0 0 .033-1.38L38 16zM28 5l.74-.673a1 1 0 0 0-1.447-.034L28 5zM9 28.9l-.707.707.049.046L9 28.9zm0-2.8-.707-.707L9 26.1zm3.5-3.5.707.707-.707-.707zm4.9 11.9-.707-.707a.994.994 0 0 0-.046.049l.753.658zm11.8-5.6.707-.707a1.075 1.075 0 0 0-.026-.026l-.68.733zM32 26l.753-.659a.994.994 0 0 0-.046-.048L32 26zm-1.793-3.207a1 1 0 0 0-1.414 1.414l1.414-1.414zm-3.1 8.2a1 1 0 0 0-1.414 1.414l1.415-1.414zm1.374-4.126a1 1 0 0 0-1.361 1.466l1.36-1.466zm-6.774 4.426a1 1 0 0 0-1.414 1.414l1.414-1.414zM26 34.7l-.573-.82a.995.995 0 0 0-.027.02l.6.8zm.3-3-.733.68.026.027.707-.707zm-.567-2.08a1 1 0 0 0-1.466 1.36l1.466-1.36zM6.707 17.293a1 1 0 0 0-1.414 1.414l1.414-1.414zm3.586 6.414a1 1 0 0 0 1.414-1.414l-1.414 1.414zM19 16l-.287-.958a.507.507 0 0 0-.018.006L19 16zm4 1 .707-.707a1.011 1.011 0 0 0-.082-.074L23 17zm-8.74-9.673-10 11 1.48 1.346 10-11-1.48-1.346zM5.707 18.293l-3-3-1.414 1.414 3 3 1.414-1.414zm-2.967-1.62 10-11-1.48-1.346-10 11 1.48 1.346zm8.553-10.966 3 3 1.414-1.414-3-3-1.414 1.414zM24.26 8.673l10 11 1.48-1.346-10-11-1.48 1.346zm11.447 11.034 3-3-1.414-1.414-3 3 1.414 1.414zm3.033-4.38-10-11-1.48 1.346 10 11 1.48-1.346zM27.293 4.293l-3 3 1.414 1.414 3-3-1.414-1.414zm-17.585 23.9c-.41-.41-.41-.976 0-1.386l-1.415-1.414c-1.19 1.19-1.19 3.024 0 4.214l1.415-1.414zm0-1.386 3.5-3.5-1.415-1.414-3.5 3.5 1.415 1.414zm3.5-3.5c.409-.41.976-.41 1.385 0l1.415-1.414c-1.191-1.19-3.024-1.19-4.215 0l1.415 1.414zm1.385 0c.41.41.41.976 0 1.386l1.415 1.414c1.19-1.19 1.19-3.024 0-4.214l-1.415 1.414zm0 1.386-3.5 3.5 1.415 1.414 3.5-3.5-1.415-1.414zm-3.451 3.454a1.13 1.13 0 0 1-1.483 0l-1.317 1.506a3.13 3.13 0 0 0 4.117 0l-1.317-1.506zm1.365 2.846c-.409-.41-.41-.976 0-1.386l-1.414-1.414c-1.19 1.19-1.19 3.023 0 4.214l1.414-1.414zm3.5-4.886c.41-.41.977-.41 1.386 0l1.414-1.414c-1.19-1.19-3.023-1.19-4.214 0l1.415 1.414zm1.386 0c.41.41.41.977 0 1.386l1.414 1.414c1.19-1.19 1.19-3.023 0-4.214l-1.414 1.414zm0 1.386-3.5 3.5 1.414 1.414 3.5-3.5-1.414-1.414zm-3.545 3.549c-.277.316-.903.388-1.34-.05l-1.415 1.415c1.162 1.163 3.137 1.235 4.26-.048l-1.505-1.318zm1.46 2.751c-.41-.41-.41-.976 0-1.386l-1.415-1.414c-1.19 1.19-1.19 3.024 0 4.214l1.414-1.414zm3.5-4.886c.409-.41.975-.41 1.385 0l1.414-1.414c-1.19-1.19-3.023-1.19-4.214 0l1.414 1.414zm1.385 0c.41.41.41.977 0 1.386l1.414 1.414c1.19-1.19 1.19-3.024 0-4.214l-1.414 1.414zm0 1.386-3.5 3.5 1.414 1.414 3.5-3.5-1.414-1.414zm-3.546 3.549c-.277.316-.902.389-1.34-.049l-1.414 1.414c1.162 1.163 3.137 1.235 4.26-.048l-1.506-1.317zm11.846-4.235c1.19 1.19 3.024 1.19 4.214 0l-1.414-1.414c-.41.41-.976.41-1.386 0l-1.414 1.414zm4.214 0c1.374-1.373.99-3.187.046-4.265l-1.505 1.317c.456.52.472 1.107.045 1.534l1.414 1.414zm0-4.314-2.5-2.5-1.414 1.414 2.5 2.5 1.414-1.414zm-7.014 7.114c1.19 1.19 3.024 1.19 4.214 0l-1.414-1.414c-.41.41-.976.41-1.385 0l-1.415 1.414zm4.214 0c1.191-1.19 1.19-3.024 0-4.214l-1.414 1.414c.41.41.41.977 0 1.386l1.415 1.414zm-.026-4.24-1.4-1.3-1.361 1.466 1.4 1.3 1.36-1.466zm-9.588 4.54 2.4 2.4 1.414-1.414-2.4-2.4-1.414 1.414zm2.4 2.4c.97.97 2.623 1.356 3.907.393l-1.2-1.6c-.316.237-.863.223-1.293-.207l-1.414 1.414zm3.88.412c1.508-1.055 1.676-3.284.434-4.526l-1.414 1.414c.358.359.326 1.129-.166 1.474l1.146 1.638zm.46-4.5-1.3-1.4-1.466 1.361 1.3 1.4 1.466-1.36zM5.293 18.708l5 5 1.414-1.414-5-5-1.414 1.414zM26 9l-.707-.707h-.001v.001h-.001v.001l-.001.001-.001.001h-.001v.001l-.001.001h-.001V8.3l-.002.001v.001h-.001l-.001.002-.002.002-.002.002-.002.002h-.001a.13.13 0 0 0-.006.007l-.002.001v.002l-.002.001-.002.002a.103.103 0 0 0-.004.004l-.002.002-.001.001-.002.002-.002.001-.001.002-.002.002-.002.002-.002.001c0 .001 0 .002-.002.002l-.001.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.003.002-.002.003-.002.002-.002.002-.003.002-.002.003-.002.002-.002.002a.272.272 0 0 0-.005.005l-.003.003-.002.002-.003.003-.002.002-.003.003-.002.002-.003.003-.003.003-.003.002-.002.003-.003.003-.003.002-.003.003-.002.003-.003.003a.072.072 0 0 0-.003.003l-.003.003a.073.073 0 0 0-.003.003l-.003.003-.003.003a.853.853 0 0 0-.003.003l-.003.003-.003.003a.1.1 0 0 1-.003.003l-.003.003-.003.003-.003.003-.003.003a.493.493 0 0 0-.007.007l-.003.003a.108.108 0 0 1-.007.007l-.003.003a1956203611.42 1956203611.42 0 0 0-.007.007l-.003.003-.004.004-.003.003-.004.003c0 .002-.002.003-.003.004l-.004.004a1.197 1.197 0 0 0-.003.003l-.004.004-.003.003-.004.004-.004.003c0 .002-.002.003-.003.004a.117.117 0 0 0-.008.008l-.004.003-.003.004-.004.004-.004.004-.004.003c0 .002-.002.003-.003.004a1.407 1.407 0 0 0-.004.004l-.004.004a.717.717 0 0 0-.004.004l-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004a.152.152 0 0 1-.008.008l-.004.004-.004.004-.004.004-.004.004a.16.16 0 0 0-.005.004c0 .002-.002.003-.004.005l-.004.004-.004.004-.004.004-.005.004-.004.005-.004.004a.175.175 0 0 1-.005.004c0 .002-.002.003-.004.005l-.004.004-.005.004c0 .002-.002.003-.004.005l-.004.004-.005.004-.004.005a.167.167 0 0 0-.004.004l-.005.005-.005.004-.004.005a1.916 1.916 0 0 0-.005.004l-.004.005-.005.004-.004.005-.005.004-.004.005-.005.005-.005.004-.004.005-.005.005-.004.004a.173.173 0 0 0-.005.005l-.005.005a.208.208 0 0 0-.01.009c0 .002-.002.003-.004.005a.21.21 0 0 0-.005.005l-.005.004-.004.005-.005.005-.005.005-.005.005-.005.004a.225.225 0 0 0-.004.005l-.005.005a.205.205 0 0 0-.005.005l-.005.005-.005.005-.005.005-.005.005-.005.004-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005a2.416 2.416 0 0 0-.005.005l-.005.006a1.215 1.215 0 0 0-.005.005l-.005.005a2.445 2.445 0 0 0-.01.01l-.005.005a2.467 2.467 0 0 0-.005.005l-.005.005-.006.005-.005.005-.005.006-.005.005-.005.005-.005.005-.006.005-.005.006-.005.005-.005.005a.233.233 0 0 0-.005.005l-.006.005-.005.006-.005.005-.005.005-.006.005a.294.294 0 0 1-.005.006l-.005.005a.265.265 0 0 0-.021.021l-.006.006-.005.005a.265.265 0 0 1-.01.01l-.006.006a.266.266 0 0 1-.016.016l-.006.005a.242.242 0 0 0-.005.006l-.005.005-.006.005-.005.006a2.742 2.742 0 0 0-.016.016l-.005.005-.006.006-.005.005-.006.006-.005.005a2.765 2.765 0 0 1-.006.005l-.005.006-.005.005a.283.283 0 0 0-.006.006l-.005.005-.006.006-.005.005-.006.005-.005.006-.005.005-.006.006a.284.284 0 0 0-.005.005l-.006.006a.284.284 0 0 0-.005.005l-.006.006-.005.005a.284.284 0 0 1-.011.01l-.006.006-.005.006-.005.005-.006.006a2.803 2.803 0 0 1-.005.005l-.006.006-.005.005-.006.006-.005.005-.006.006a.284.284 0 0 0-.01.01l-.006.006-.006.005-.005.006-.006.005-.005.006-.005.005a.284.284 0 0 1-.006.006l-.005.005-.006.006-.005.005a.284.284 0 0 1-.006.005l-.005.006a.284.284 0 0 1-.006.005l-.005.006-.005.005-.006.006-.005.005-.006.006a.283.283 0 0 1-.005.005l-.006.005a2.765 2.765 0 0 1-.005.006l-.005.005-.006.006a2.757 2.757 0 0 1-.005.005l-.006.005-.005.006-.005.005-.006.006-.005.005-.006.005-.005.006-.005.005a.267.267 0 0 1-.006.006l-.005.005a.266.266 0 0 0-.005.005l-.006.006a.242.242 0 0 0-.005.005l-.006.005-.005.006a2.696 2.696 0 0 1-.005.005l-.005.005-.006.006-.005.005-.005.005-.006.006-.005.005-.005.005a.264.264 0 0 1-.006.005l-.005.006-.005.005a.24.24 0 0 1-.005.005l-.006.005-.005.006-.005.005-.005.005-.006.005-.005.006-.005.005-.005.005-.005.005a.231.231 0 0 1-.005.005l-.006.005-.005.006-.005.005a.253.253 0 0 1-.005.005l-.005.005-.005.005-.005.005-.006.005a2.445 2.445 0 0 1-.005.005l-.005.005-.005.006-.005.005-.005.005a2.402 2.402 0 0 1-.015.015l-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.004-.005.005-.005.005-.004.005-.005.005-.005.005a.205.205 0 0 1-.01.01l-.005.004a2.179 2.179 0 0 1-.014.015l-.005.005-.005.004-.004.005-.005.005a2.119 2.119 0 0 1-.01.01l-.004.004-.005.005-.005.004-.004.005-.005.005-.004.004a.181.181 0 0 1-.01.01l-.004.004a.18.18 0 0 1-.005.004l-.004.005a1.922 1.922 0 0 1-.005.005l-.004.004-.005.004-.004.005-.005.004-.004.005a.183.183 0 0 1-.005.004c0 .002-.002.003-.004.005a.182.182 0 0 1-.004.004l-.005.004-.004.005-.004.004-.005.004-.004.005-.004.004-.005.004c0 .002-.002.003-.004.004l-.004.005-.004.004-.004.004-.005.004c0 .002-.002.003-.004.004l-.004.005-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004a8491334680.957 8491334680.957 0 0 1-.008.008l-.004.004-.004.004-.004.004-.004.003c0 .002-.002.003-.003.004l-.004.004-.004.004-.004.004-.004.003c0 .002-.002.003-.003.004l-.004.004a3633073655.432 3633073655.432 0 0 0-.008.007c0 .002-.002.003-.003.004l-.004.004-.003.003-.004.004-.004.003-.003.004-.003.003-.004.004-.003.003-.004.004a3250884297.246 3250884297.246 0 0 0-.01.01l-.003.003-.004.004-.003.003-.003.003-.004.003a2716058231.859 2716058231.859 0 0 1-.006.007l-.003.003-.003.003-.003.003-.004.003-.003.004-.003.003-.003.003-.003.003-.003.002c0 .002-.002.002-.003.003l-.003.003-.002.003-.003.003-.003.003-.003.003-.003.003-.003.002-.002.003-.003.003-.003.002-.002.003-.003.003-.002.002-.003.003-.003.002-.002.003-.003.002-.002.003-.002.002-.003.002-.002.003-.002.002-.003.002-.002.003-.002.002-.002.002-.003.002-.002.003-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.001.001-.002.002-.002.002 1.414 1.414.002-.002.002-.002.002-.001.001-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.003-.002.002-.003.002-.002.002-.002.002-.002.003-.003.002-.002.003-.002.002-.003.002-.002.003-.002.002-.003.003-.003.002-.002.003-.003.002-.002.003-.003.003-.002.002-.003.003-.003.003-.002a.037.037 0 0 0 .003-.003l.002-.003.003-.003.003-.003.003-.003.003-.002a.08.08 0 0 1 .003-.003l.003-.003.003-.003.003-.003.003-.003a.09.09 0 0 1 .006-.006l.003-.004.003-.003a.092.092 0 0 1 .003-.003l.003-.003.003-.003.004-.003c0-.002.002-.003.003-.004l.003-.003.003-.003a2889930025.631 2889930025.631 0 0 1 .007-.007l.003-.003a.055.055 0 0 1 .004-.004l.003-.003.004-.003c0-.002.002-.003.003-.004l.004-.003c0-.002.002-.003.003-.004l.004-.004a3439172743.957 3439172743.957 0 0 0 .007-.007l.003-.003.004-.004.004-.003.003-.004.004-.004.004-.004a.13.13 0 0 1 .004-.003c0-.002.002-.003.003-.004l.004-.004.004-.004.004-.004.004-.003c0-.002.002-.003.004-.004 0-.002.002-.003.003-.004a.149.149 0 0 1 .008-.008l.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.005-.004c0-.002.002-.003.004-.004l.004-.005.004-.004.004-.004.004-.004.005-.004a.172.172 0 0 1 .008-.009l.004-.004.005-.004.004-.005.004-.004.005-.004a.18.18 0 0 1 .004-.005l.004-.004.005-.005.004-.004.005-.004.004-.005.005-.004.004-.005.004-.004.005-.005a.197.197 0 0 1 .005-.004l.004-.005.005-.005a.197.197 0 0 1 .013-.013l.005-.005a3743849765.858 3743849765.858 0 0 0 .01-.01l.004-.004a.104.104 0 0 1 .01-.01l.004-.004.005-.005.005-.004.004-.005.005-.005.005-.005.005-.005.005-.004.004-.005.005-.005.005-.005.005-.005.005-.005.005-.005a.229.229 0 0 1 .01-.01l.005-.004.004-.005.005-.005a.233.233 0 0 1 .005-.005l.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005a.118.118 0 0 0 .005-.005l.006-.005.005-.005.005-.005.005-.005.005-.006.005-.005.005-.005a.253.253 0 0 1 .005-.005l.005-.005.005-.005.006-.005a.253.253 0 0 1 .005-.006l.005-.005.005-.005.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006.005-.005.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006a.267.267 0 0 1 .005-.005l.006-.005a.267.267 0 0 1 .005-.006l.005-.005a.267.267 0 0 1 .006-.005l.005-.006.006-.005.005-.006a.267.267 0 0 1 .005-.005l.006-.005.005-.006.005-.005.006-.006.005-.005.006-.005.005-.006.005-.005.006-.006.005-.005.006-.005.005-.006.006-.005.005-.006.005-.005a.143.143 0 0 0 .006-.006l.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006.005-.005.006-.006.005-.005.006-.006.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006.006-.005a.283.283 0 0 1 .005-.006l.005-.005.006-.006.005-.005a.283.283 0 0 1 .006-.006l.005-.005a.143.143 0 0 0 .006-.006l.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006.006-.005.005-.006.006-.005a.283.283 0 0 1 .005-.006l.005-.005.006-.006.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006a.143.143 0 0 0 .006-.005l.005-.006.005-.005.006-.006.005-.005.006-.005.005-.006a.283.283 0 0 1 .006-.005l.005-.006.005-.005.006-.005.005-.006.006-.005.005-.006.005-.005.006-.005.005-.006.005-.005.006-.005.005-.006.006-.005a.267.267 0 0 1 .005-.006l.005-.005.005-.005.006-.006.005-.005a.267.267 0 0 1 .01-.01l.006-.006.005-.005.006-.005a.262.262 0 0 1 .01-.011l.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005a.253.253 0 0 1 .005-.005l.006-.005a.253.253 0 0 1 .005-.005l.005-.006.005-.005a.253.253 0 0 1 .005-.005l.005-.005.005-.005.005-.005.005-.005.006-.005a.238.238 0 0 1 .005-.005l.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.004-.005.005-.005.005-.005.005-.005.005-.005a.224.224 0 0 1 .005-.005l.005-.005.005-.004.004-.005.005-.005.005-.005.005-.005.005-.004.004-.005a.21.21 0 0 1 .01-.01l.004-.004.005-.005.005-.005a.206.206 0 0 1 .004-.004l.005-.005.005-.004.004-.005.005-.005.004-.004.005-.005.005-.004.004-.005.005-.004.004-.005.005-.005.004-.004.005-.005.004-.004.005-.004.004-.005.004-.004.005-.005.004-.004.004-.004.005-.005.004-.004.004-.004.005-.004.004-.005.004-.004.004-.004.005-.004c0-.002.002-.003.004-.004l.004-.005.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004a.153.153 0 0 1 .004-.004l.004-.004a.149.149 0 0 1 .008-.008.136.136 0 0 1 .008-.008 8072996200.381 8072996200.381 0 0 0 .008-.008l.004-.004.004-.003c0-.002.002-.003.004-.004 0-.002.002-.003.003-.004l.004-.004.004-.004.003-.003.004-.004.004-.004a.626.626 0 0 1 .004-.003c0-.002.002-.003.003-.004l.004-.004.003-.003.004-.004a.116.116 0 0 1 .01-.01l.004-.004.004-.003a.1.1 0 0 1 .003-.004l.003-.003a.109.109 0 0 1 .004-.003c0-.002.002-.003.003-.004l.003-.003a1.031 1.031 0 0 1 .014-.013l.003-.003c0-.002.002-.003.003-.004a.096.096 0 0 0 .003-.003l.003-.003.003-.003.003-.003.003-.003a.866.866 0 0 1 .006-.006l.003-.003a.832.832 0 0 1 .003-.003l.003-.003.003-.003.003-.003.003-.003.003-.003.003-.002.002-.003.003-.003.003-.003.002-.002.003-.003.003-.002.002-.003.003-.003.002-.002.003-.003.002-.002.003-.003.002-.002.003-.002.002-.003.002-.002.003-.003.002-.002.002-.002.003-.002c0-.001 0-.002.002-.002l.002-.003.002-.002.002-.002.002-.002a.2.2 0 0 1 .002-.002l.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002a.155.155 0 0 1 .003-.003l.002-.002.002-.002.002-.001.001-.002.002-.002.001-.001.002-.002.002-.001.001-.002.002-.001v-.002l.002-.001.002-.001.001-.002.001-.001.002-.001v-.002a.134.134 0 0 1 .004-.003l.001-.001.001-.001.001-.001.001-.001.001-.001.001-.001h.001v-.002h.002v-.001l.001-.001.002-.001v-.001l.001-.001.001-.001.001-.001h.001v-.001h.001L26 9zm-2.707 1.293c.173-.173.343-.193.27-.176a1.45 1.45 0 0 1-.208.026c-.234.018-.56.02-.949.007-.772-.024-1.67-.096-2.33-.147l-.153 1.994c.641.05 1.593.127 2.42.152.412.013.823.015 1.164-.011.169-.013.35-.035.52-.075.121-.029.432-.108.68-.356l-1.414-1.414zm-3.216-.29c-.515-.04-1.053.08-1.527.23-.489.155-.997.373-1.478.6-.482.229-.961.478-1.388.7-.437.229-.805.422-1.103.559l.838 1.816c.352-.163.771-.382 1.19-.601.43-.225.876-.456 1.319-.665.444-.21.86-.386 1.228-.503.383-.121.632-.152.767-.142l.154-1.994zm-5.496 2.089c-.692.32-1.356.747-1.664 1.414-.354.768-.096 1.494.235 2.024l1.696-1.06a.699.699 0 0 1-.1-.208c0-.002.001.01-.001.03a.181.181 0 0 1-.014.052c-.01.02.002-.019.112-.106.111-.088.292-.2.574-.33l-.838-1.816zm-1.429 3.438c.427.684 1.31 1.242 2.323 1.531 1.06.303 2.386.353 3.83-.109l-.61-1.904c-1.056.338-1.98.288-2.67.09-.737-.21-1.104-.552-1.177-.668l-1.696 1.06zm6.135 1.428c.677-.203 1.416-.047 2.065.235a5.393 5.393 0 0 1 1.018.584l.008.006h-.001v-.001h-.001L23 17c.625-.78.624-.781.624-.781l-.002-.002-.003-.002-.009-.007-.026-.02a6.368 6.368 0 0 0-.387-.27 7.42 7.42 0 0 0-1.05-.56c-.85-.369-2.111-.713-3.434-.316l.574 1.916zm3.006.75 8 8 1.414-1.415-8-8-1.414 1.414zm-9-8 3 3 1.414-1.415-3-3-1.414 1.414zm20 7.585-4.5 4.5 1.414 1.414 4.5-4.5-1.414-1.414z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="donation-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M2 19a1 1 0 1 0 0 2v-2zm36 2a1 1 0 1 0 0-2v2zM21 8a1 1 0 1 0-2 0h2zm-2 24a1 1 0 1 0 2 0h-2zm7-13.7-.676-.737a.892.892 0 0 0-.031.03L26 18.3zm-12 0 .708-.707a.986.986 0 0 0-.032-.03l-.675.737zm0 4.7a1 1 0 1 0 0 2v-2zm12 2a1 1 0 1 0 0-2v2zM2 21h36v-2H2v2zM19 8v24h2V8h-2zm6.293 9.593c-.099.099-.415.283-1.02.49-.559.193-1.23.361-1.892.501a32.888 32.888 0 0 1-2.491.422l-.01.001h-.001L20 20l.122.993h.001l.004-.001c.003 0 .007 0 .012-.002.01 0 .025-.003.044-.005a27.755 27.755 0 0 0 .752-.108 35.006 35.006 0 0 0 1.859-.336c.7-.148 1.46-.336 2.13-.566.623-.214 1.332-.517 1.783-.968l-1.414-1.414zM20 20l.925.38v-.002l.004-.008.013-.03.05-.121c.045-.105.11-.258.192-.445.163-.375.392-.885.654-1.427a23.39 23.39 0 0 1 .839-1.596c.297-.508.55-.864.73-1.044l-1.414-1.414c-.37.37-.73.914-1.042 1.447a25.492 25.492 0 0 0-.914 1.737 43.527 43.527 0 0 0-.957 2.13l-.004.01v.002l-.001.001L20 20zm3.407-4.293a2.28 2.28 0 0 1 1.328-.663c.446-.05.77.074.958.263l1.414-1.414c-.711-.712-1.688-.937-2.592-.837-.907.1-1.816.53-2.522 1.237l1.414 1.414zm2.286-.4c.404.405.515 1.446-.369 2.256l1.352 1.474c1.516-1.39 1.827-3.749.431-5.144l-1.414 1.414zm-12.4 3.7c.452.451 1.161.754 1.784.968.669.23 1.429.418 2.13.566a35.003 35.003 0 0 0 2.61.444l.044.005.012.002h.005L20 20l.122-.993h-.003l-.008-.001a4.733 4.733 0 0 1-.189-.025 32.903 32.903 0 0 1-2.303-.397 16.575 16.575 0 0 1-1.892-.5c-.605-.208-.92-.392-1.02-.491l-1.414 1.414zM20 20l.925-.38-.001-.003-.004-.01a5.06 5.06 0 0 0-.07-.165 43.862 43.862 0 0 0-.887-1.964 25.3 25.3 0 0 0-.914-1.738c-.312-.533-.67-1.077-1.041-1.447l-1.415 1.414c.18.18.433.536.73 1.044.287.488.577 1.053.84 1.596a41.814 41.814 0 0 1 .908 2.023l.003.008v.001L20 20zm-1.992-5.707a4.278 4.278 0 0 0-2.522-1.237c-.905-.1-1.881.126-2.593.837l1.415 1.414c.188-.189.512-.313.957-.263.444.05.935.27 1.328.663l1.415-1.414zm-5.114-.4c-1.396 1.395-1.085 3.754.43 5.144l1.352-1.474c-.884-.81-.773-1.851-.368-2.256l-1.415-1.414zM20 20l-.997-.076v-.01.01a2.68 2.68 0 0 1-.093.403 3.31 3.31 0 0 1-.558 1.054C17.778 22.11 16.585 23 14 23v2c3.115 0 4.922-1.11 5.923-2.381.485-.616.75-1.23.896-1.696a4.668 4.668 0 0 0 .169-.756 2.448 2.448 0 0 0 .009-.086v-.005L20 20zm0 0-.999.051v.005l.001.008.001.02a2.604 2.604 0 0 0 .029.24c.022.147.061.346.13.581.136.468.392 1.088.873 1.708C21.028 23.895 22.842 25 26 25v-2c-2.642 0-3.828-.895-4.385-1.613a3.15 3.15 0 0 1-.533-1.042 2.558 2.558 0 0 1-.083-.398v-.009.012L20 20zM6 32c-1.546 0-2.493-.386-3.063-.964C2.365 30.454 2 29.503 2 28H0c0 1.797.435 3.346 1.513 4.44C2.593 33.535 4.146 34 6 34v-2zm-4-4V12H0v16h2zm0-16c0-1.504.365-2.454.937-3.036C3.507 8.386 4.454 8 6 8V6c-1.854 0-3.407.464-4.487 1.56C.435 8.655 0 10.205 0 12h2zm4-4h28V6H6v2zm28 0c1.546 0 2.493.386 3.063.964.572.582.937 1.532.937 3.036h2c0-1.796-.435-3.346-1.513-4.44C37.407 6.465 35.854 6 34 6v2zm4 4v16h2V12h-2zm0 16c0 1.4-.477 2.35-1.217 2.97-.766.643-1.937 1.03-3.483 1.03v2c1.854 0 3.533-.462 4.767-1.496C39.327 31.45 40 29.901 40 28h-2zm-4.7 4H6v2h27.3v-2z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="event-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m22.3 17.1 4.7.9-3.3 3.4.6 4.6-4.3-2-4.3 2 .6-4.6L13 18l4.7-.9L20 13l2.3 4.1z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"></path>
                                                <path d="M38 33H2c-.6 0-1-.4-1-1V8c0-.6.4-1 1-1h36c.6 0 1 .4 1 1v24c0 .6-.4 1-1 1z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="membership-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M23 15a1 1 0 1 0 0 2v-2zm10 2a1 1 0 1 0 0-2v2zm-10 2a1 1 0 1 0 0 2v-2zm7 2a1 1 0 1 0 0-2v2zm-7 2a1 1 0 1 0 0 2v-2zm8 2a1 1 0 1 0 0-2v2zm-15.392.51a1 1 0 0 0 1.585-1.22l-1.585 1.22zm-9-1.22a1 1 0 0 0 1.585 1.22l-1.585-1.22zM37 32H3v2h34v-2zM3 32c-.548 0-1-.452-1-1H0c0 1.652 1.348 3 3 3v-2zm-1-1V9H0v22h2zM2 9c0-.548.452-1 1-1V6C1.348 6 0 7.348 0 9h2zm1-1h34V6H3v2zm34 0c.548 0 1 .452 1 1h2c0-1.652-1.348-3-3-3v2zm1 1v22h2V9h-2zm0 22c0 .548-.452 1-1 1v2c1.652 0 3-1.348 3-3h-2zM23 17h10v-2H23v2zm0 4h7v-2h-7v2zm0 4h8v-2h-8v2zm-9.1-7a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4h-2zm-2 2a2 2 0 0 1-2-2h-2a4 4 0 0 0 4 4v-2zm-2-2a2 2 0 0 1 2-2v-2a4 4 0 0 0-4 4h2zm2-2a2 2 0 0 1 2 2h2a4 4 0 0 0-4-4v2zm5.293 8.29c-1.184-1.539-3.173-2.59-5.293-2.59v2c1.48 0 2.891.748 3.708 1.81l1.585-1.22zM11.9 21.7c-2.12 0-4.109 1.051-5.292 2.59l1.585 1.22c.816-1.062 2.227-1.81 3.707-1.81v-2z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="food-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <g clip-path="url(#clip0)">
                                                    <path d="M14.293 21.85 1.758 34.132c-1.01.99-1.01 2.972 0 3.962 1.011.99 3.033.99 4.044 0l12.737-14.859m4.145-4.953c1.214-1.283 2.528-2.675 2.528-2.675 1.718 1.684 4.288 1.392 6.47-.693 2.18-2.086 5.812-6.747 6.065-7.33.253-.585.71-1.385 0-2.081a1.487 1.487 0 0 0-2.123 0m0 0c-.1.099-.1.099 0 0zm0 0c.607-.595.607-1.486 0-2.08a1.487 1.487 0 0 0-2.123 0m2.123 2.08s-3.942 3.92-6.124 6.124m4.001-8.204c-.1.099-.1.099 0 0zm0 0c.607-.595.607-1.486 0-2.08-.606-.595-1.367-.47-2.123 0-.755.468-7.48 5.943-7.48 5.943-1.82 1.486-2.427 4.656-.708 6.34 0 0-1.61 1.34-2.83 2.476M33.5 3.423s-1.001 1.077-6 6.001M3.78 1.442S37 32 38.15 33.142c1.152 1.142.81 4.061 0 4.953-.909.892-3.74 1.486-5.054 0L22.987 24.227c-.808-.991-3.74-.991-5.054-.991-1.416 0-3.235-.892-4.044-1.981L4.791 10.358C2.97 7.98 2.162 4.018 3.78 1.442z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                                                </g>
                                                <defs>
                                                    <clippath id="clip0">
                                                        <path d="M0 0h40v40H0z" fill="var(--background-fill)"></path>
                                                    </clippath>
                                                </defs>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="image-icon" viewbox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="64" width="64" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                                <path clip-rule="evenodd" d="M28.372 28.25c1.196 0 2.166-1.007 2.166-2.25s-.97-2.25-2.166-2.25-2.166 1.007-2.166 2.25.97 2.25 2.166 2.25zm-1.288 3.913a1 1 0 0 0-1.562.154L21.42 38.71a1 1 0 0 0 .841 1.54h19.504a1 1 0 0 0 .857-1.515l-5.552-9.23a1 1 0 0 0-1.65-.094l-4.173 5.42a1 1 0 0 1-1.513.083l-2.649-2.752z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="section-icon" viewbox="0 0 16 16">
                                            <path d="M.667.057a.993.993 0 0 0-.66 1.021.96.96 0 0 0 .556.819l.201.099 7.174.008c6.45.007 7.19.003 7.336-.039.354-.103.576-.325.709-.708.052-.147.062-.42.019-.499a5.394 5.394 0 0 1-.09-.189 1.078 1.078 0 0 0-.482-.476l-.165-.078-7.22-.007C1.114.002.819.004.667.057m-.657.949c0 .115.005.159.012.097a1.238 1.238 0 0 0 0-.211C.015.839.01.89.01 1.006m.753 3.021a1.11 1.11 0 0 0-.557.368c-.219.291-.208.084-.199 3.665l.008 3.212.083.169c.097.198.298.395.497.487l.14.064 7.23.008 7.229.008.175-.071a.999.999 0 0 0 .597-.629c.064-.173.064-.184.064-3.354 0-2.101-.01-3.181-.03-3.181-.017 0-.03-.021-.03-.046 0-.136-.233-.451-.422-.57-.277-.175.223-.165-7.546-.161-4.21.002-7.167.014-7.239.031M.014 8c0 1.767.004 2.485.009 1.596.004-.888.004-2.334 0-3.212C.018 5.506.014 6.233.014 8m1.997 0v1.996h11.978V6.004H2.011V8M.832 14.02a1.028 1.028 0 0 0-.739.569c-.065.138-.078.208-.078.42 0 .213.013.283.078.421.093.196.287.395.476.488l.136.067 7.256.008 7.255.007.169-.063c.367-.137.645-.56.645-.981 0-.103-.01-.187-.023-.187s-.047-.068-.077-.151c-.073-.207-.32-.451-.55-.544l-.175-.07L8.09 14c-3.913-.003-7.179.006-7.258.02m-.822.989c0 .124.005.175.012.113a1.408 1.408 0 0 0 0-.225c-.007-.062-.012-.011-.012.112" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="category-folder-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M39 17a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4m14.5-8L11 5H2a1 1 0 0 0-1 1v27a2 2 0 0 0 2 2h34a2 2 0 0 0 2-2V10a1 1 0 0 0-1-1H15.5z" stroke="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="phone-icon" viewbox="0 0 16 16">
                                            <svg fill="none" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m9.606 9.333-.04.04-.035.044-.526.66A9.316 9.316 0 0 1 5.94 7.036l.683-.581.037-.032.034-.036a1.68 1.68 0 0 0 .394-1.673l-.002-.009-.003-.008A6.435 6.435 0 0 1 6.76 2.66C6.76 1.748 6.012 1 5.1 1H2.793c-.303 0-.716.063-1.087.311A1.585 1.585 0 0 0 1 2.66C1 9.406 6.601 15 13.34 15a1.59 1.59 0 0 0 1.326-.681c.253-.361.334-.774.334-1.106v-2.3c0-.912-.748-1.66-1.66-1.66-.71 0-1.397-.115-2.039-.322a1.652 1.652 0 0 0-1.695.402z" stroke="var(--icon-fill)" stroke-width="2"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="direction-icon" viewbox="0 0 21 21">
                                            <svg fill="none" height="21" width="21" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m19.71 10.29-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM12 13.5V11H8v3H6v-4c0-.55.45-1 1-1h5V6.5l3.5 3.5-3.5 3.5z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="map-icon" viewbox="0 0 20 19">
                                            <svg fill="none" height="19" width="20" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m19.32 2.05-6-2h-.07a.7.7 0 0 0-.14 0h-.43L7 2 1.32.05a1 1 0 0 0-.9.14A1 1 0 0 0 0 1v14a1 1 0 0 0 .68.95l6 2a1 1 0 0 0 .62 0l5.7-1.9L18.68 18c.106.014.214.014.32 0a.94.94 0 0 0 .58-.19A1.001 1.001 0 0 0 20 17V3a1 1 0 0 0-.68-.95zM6 15.61l-4-1.33V2.39l4 1.33v11.89zm6-1.33-4 1.33V3.72l4-1.33v11.89zm6 1.33-4-1.33V2.39l4 1.33v11.89z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="list-icon" viewbox="0 0 24 24">
                                            <svg fill="none" height="24" width="24" xmlns="http://www.w3.org/2000/svg">
                                                <path clip-rule="evenodd" d="M3 2a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3zm1 18V4h16v16H4zM7 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm1 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm2-8a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-6zm-1 5a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                            </svg>
                                        </symbol>
                                    </svg>
                                    <!-- -->undefined
                                </div>undefined
                            </div>undefined<div data-v-90c54f5a="">undefined
                                <!-- -->undefined
                            </div>undefined<div class="cko 📚19-4-0rI2oH cko--close cko--flyover" data-v-90c54f5a="" style='--maker-color-neutral-0: #343b42; --maker-color-neutral-10: #5d6368; --maker-color-neutral-20: #797e83; --maker-color-neutral-80: #9da1a5; --maker-color-neutral-90: #f4f4f5; --maker-color-neutral-100: #ffffff; --maker-color-primary: #212121; --maker-color-background: #343b42; --maker-color-heading: #ffffff; --maker-color-body: #ffffff; --maker-color-elevation: #797e83; --maker-color-overlay: rgba(255, 255, 255, 0.32); --maker-color-error-fill: #cd2026; --maker-font-heading-font-family: "Roboto"; --maker-font-heading-font-weight: 300; --maker-font-body-font-family: "Roboto"; --maker-font-body-font-weight: 400; --maker-font-label-font-family: "Roboto"; --maker-font-label-font-weight: 500; --maker-shape-default-border-radius: 8px; --maker-shape-card-border-radius: 4px; --maker-shape-button-border-radius: 8px; --maker-shape-image-border-radius: 0px; --maker-shape-thumbnail-border-radius: 0px;'>undefined<div class="cko__header">
                                    <div class="cko__header-items cko--max-width">
                                        <div class="cko__header-back">
                                            <button class="cko__back-btn 📚19-4-0_xxoX 📚19-4-0t5BZq" style="--color: #ffffff;" title="Back to Cart" type="button">
                                                <!-- -->
                                                <span class="📚19-4-0qfj5z 📚19-4-0QESOt">
                                                    <span class="icon cko__back-btn-icon 📚19-4-0vCfSe cko__back-btn-icon--medium" data-v-4700918e="" style="--color: currentColor; --icon-size: 16px; --fill: currentColor;">
                                                        <svg fill="none" viewbox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                                            <path clip-rule="evenodd" d="M4.3 7.3a1 1 0 0 0 0 1.4l6 6 1.4-1.4L6.42 8l5.3-5.3-1.42-1.4-6 6Z" fill="currentColor" fill-rule="evenodd"></path>
                                                        </svg>
                                                    </span>
                                                    <span class="cko__back-btn-label display-inline-phone-up">
                                                        <p class="cko__back-btn-label-text 📚19-4-0uGevg 📚19-4-0EEwzY" style='--mobile-base-font-size: 20; --mobile-font-size-scale: 1.25; font-family: "Roboto"; font-weight: 400; color: rgb(255, 255, 255);'> Back to Cart </p>
                                                    </span>
                                                </span>
                                            </button>
                                        </div>
                                        <div class="cko__header-title">
                                            <img alt="BookTomNYC" height="38" src="https://lh3.googleusercontent.com/drive-viewer/AK7aPaDdij7LcR2tH8oPh50Sn0rASvfnRJeerh-70oZjBsHUCr7ZPHiPtkwfWubkbf_DTbcxTFEQfPULuCJMl2vZt-QKkJZp=w1920-h963?width=400" />
                                        </div>
                                        <div></div>
                                    </div>undefined
                                </div>undefined<div class="cko__body cko--max-width">
                                    <!-- -->
                                    <svg style="display: none;" xmlns="http://www.w3.org/2000/svg">
                                        <symbol fill="none" id="alert-triangle-icon" viewbox="0 0 16 16">
                                            <path clip-rule="evenodd" d="M.41 13.759 7.561.794a.5.5 0 0 1 .876 0l7.153 12.965a.5.5 0 0 1-.438.741H.847a.5.5 0 0 1-.438-.741zM8 9.002a1 1 0 0 1-1-1v-2a1 1 0 0 1 2 0v2a1 1 0 0 1-1 1zm0 1A1 1 0 1 0 8 12a1 1 0 0 0 0-2z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="email-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm3.5-3h9L8.707 8.793a1 1 0 0 1-1.414 0L3.5 5zM3 6l3.586 3.586a2 2 0 0 0 2.828 0L13 6v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="embed-code-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M0 0h22v12H0z" fill="var(--background-fill)" transform="translate(21 26)"></path>
                                            <path d="m36 38 7-6-7-6M28 26l-7 6 7 6" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                                        </symbol>
                                        <symbol fill="none" id="embed-pdf-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M29.677 32.716s-3.829 10.074-6.974 9.234c-3.145-.84 5.06-5.516 8.752-6.116 3.692-.6 10.939-3.358 10.528 0-.547 3.358-5.743-.6-8.75-4.557-3.009-3.958-4.24-9.834-1.778-9.235 2.46.6-.547 8.155-1.778 10.674z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"></path>
                                        </symbol>
                                        <symbol id="facebook-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8.567 4.437V8.085H9.77l.159-1.5h-1.36l.001-.75c0-.392.037-.602.6-.602h.75v-1.5H8.718c-1.444 0-1.952.728-1.952 1.952v.9h-.9v1.5h.9v4.352h1.801z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="google-plus-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8c0-4.418 3.528-8 7.88-8s7.88 3.582 7.88 8-3.528 8-7.88 8S0 12.418 0 8zm6.438-.229v.869h1.42c-.057.373-.43 1.093-1.42 1.093-.855 0-1.552-.717-1.552-1.6 0-.883.697-1.6 1.552-1.6.487 0 .812.21.998.392l.68-.663A2.385 2.385 0 0 0 6.438 5.6c-1.384 0-2.504 1.133-2.504 2.533s1.12 2.534 2.504 2.534c1.445 0 2.404-1.028 2.404-2.476 0-.166-.018-.293-.04-.42H6.438zm5.365 0h-.715v-.723h-.715v.723h-.716v.724h.716v.724h.715v-.724h.715v-.724z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="instagram-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <g fill-rule="evenodd" style="fill:var(--icon-fill)">
                                                <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-4.267c-1.158 0-1.304.005-1.759.026a3.12 3.12 0 0 0-1.035.198 2.09 2.09 0 0 0-.756.492 2.095 2.095 0 0 0-.493.756c-.106.271-.178.582-.198 1.036-.02.455-.026.6-.026 1.759 0 1.159.005 1.304.026 1.759.021.454.093.764.198 1.035.11.281.255.52.492.756.237.238.476.384.756.493.271.105.582.177 1.036.198.455.02.6.026 1.759.026 1.159 0 1.304-.005 1.759-.026.454-.02.764-.093 1.036-.198.28-.11.518-.255.755-.493.238-.237.383-.475.493-.755.105-.272.177-.582.198-1.036.02-.455.026-.6.026-1.759 0-1.159-.006-1.304-.026-1.76-.021-.453-.093-.764-.198-1.035a2.094 2.094 0 0 0-.493-.756 2.085 2.085 0 0 0-.755-.492c-.272-.105-.583-.177-1.037-.198-.455-.02-.6-.026-1.759-.026H8z"></path>
                                                <path d="M7.618 4.502H8c1.14 0 1.275.004 1.725.025.416.019.641.088.792.147.199.077.34.17.49.319.15.15.242.291.32.49.058.15.127.376.146.792.02.45.025.585.025 1.724s-.004 1.274-.025 1.724c-.019.416-.088.641-.147.792-.077.199-.17.34-.319.49a1.32 1.32 0 0 1-.49.319c-.15.059-.376.128-.792.147-.45.02-.585.025-1.725.025-1.139 0-1.274-.005-1.724-.025-.416-.02-.641-.089-.792-.147-.2-.078-.341-.17-.49-.32a1.322 1.322 0 0 1-.32-.49c-.058-.15-.128-.376-.147-.792-.02-.45-.024-.585-.024-1.724 0-1.14.004-1.274.024-1.724.02-.416.089-.641.147-.792.077-.199.17-.341.32-.49.149-.15.29-.242.49-.32.15-.058.376-.128.792-.147.394-.018.546-.023 1.342-.024v.001zm2.66.709a.512.512 0 1 0 0 1.024.512.512 0 0 0 0-1.024zM8 5.809a2.191 2.191 0 1 0 0 4.382A2.191 2.191 0 0 0 8 5.81z"></path>
                                                <path d="M8 6.578a1.422 1.422 0 1 1 0 2.844 1.422 1.422 0 0 1 0-2.844z"></path>
                                            </g>
                                        </symbol>
                                        <symbol fill="none" id="instagram-item-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M0 0h24v24H0z" fill="var(--background-fill)" transform="translate(20 20)"></path>
                                            <rect height="22" rx="5" stroke="var(--icon-fill)" stroke-width="2" width="22" x="21" y="21"></rect>
                                            <circle cx="32" cy="32" r="5" stroke="var(--icon-fill)" stroke-width="2"></circle>
                                            <circle cx="39" cy="26" fill="var(--icon-fill)" r="1"></circle>
                                        </symbol>
                                        <svg fill="none" height="24" id="tiktok-icon" width="24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 23c6.075 0 11-4.925 11-11S18.075 1 12 1 1 5.925 1 12s4.925 11 11 11z" fill="#fff" style="fill:var(--background-fill)"></path>
                                            <path clip-rule="evenodd" d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12zm1.595-18.996c-.43 0-.86.001-1.292.008a552.03 552.03 0 0 0-.01 4.496 981.783 981.783 0 0 1-.002 3.392c.001.76.002 1.518-.04 2.279-.005.21-.11.396-.211.577l-.024.043c-.335.553-.951.931-1.594.938-.97.087-1.878-.717-2.014-1.675a11.238 11.238 0 0 0-.005-.141c-.01-.27-.019-.545.083-.797.144-.418.42-.777.785-1.02.499-.352 1.166-.404 1.737-.217 0-.37.007-.738.013-1.107.008-.495.016-.99.01-1.484-1.25-.238-2.585.163-3.538 1.004a4.392 4.392 0 0 0-1.487 2.894c-.01.29-.008.58.007.868.12 1.365.937 2.637 2.1 3.332.701.42 1.524.647 2.347.599 1.342-.023 2.648-.752 3.401-1.87a4.48 4.48 0 0 0 .778-2.3 301.8 301.8 0 0 0 .01-3.365l.001-1.74c.3.199.605.393.933.543.753.363 1.587.538 2.417.565V8.477c-.886-.1-1.796-.396-2.44-1.043-.645-.632-.961-1.541-1.007-2.434-.319.003-.638.003-.958.004z" fill="#000" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </svg>
                                        <symbol id="linkedin-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm5.654-1.374H3.84v5.447h1.813V6.626zm.119-1.685C5.76 4.407 5.379 4 4.759 4s-1.026.407-1.026.94c0 .524.394.942 1.002.942h.012c.632 0 1.026-.418 1.026-.941zm6.419 4.009c0-1.673-.895-2.452-2.088-2.452-.962 0-1.393.529-1.634.9v-.772H6.657c.024.511 0 5.447 0 5.447H8.47V9.031c0-.163.012-.325.06-.442.131-.325.43-.662.93-.662.656 0 .919.5.919 1.232v2.914h1.813V8.95z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="twitter-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.76-1.497.017.276-.28-.034c-1.018-.13-1.908-.57-2.663-1.31l-.37-.367-.095.27c-.201.605-.072 1.244.347 1.673.224.237.174.271-.212.13-.135-.045-.252-.08-.263-.062-.04.04.095.553.201.757.146.282.442.559.767.723l.274.13-.325.005c-.313 0-.324.006-.29.125.111.367.553.757 1.046.926l.347.119-.302.18a3.15 3.15 0 0 1-1.5.419c-.252.005-.459.028-.459.045 0 .056.683.373 1.08.497 1.192.367 2.608.21 3.67-.418.756-.446 1.512-1.333 1.864-2.192.19-.458.38-1.294.38-1.695 0-.26.018-.294.33-.604.186-.181.36-.379.393-.435.056-.108.05-.108-.235-.012-.476.17-.543.147-.308-.107.173-.18.38-.508.38-.604 0-.017-.084.01-.179.062-.1.056-.324.141-.492.192l-.302.096-.274-.187a2.278 2.278 0 0 0-.476-.248 1.909 1.909 0 0 0-.98.022c-.699.255-1.141.91-1.09 1.628z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="vimeo-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm12.529-1.546c.057-1.25-.409-1.89-1.395-1.919-1.33-.043-2.232.708-2.704 2.253a1.8 1.8 0 0 1 .71-.158c.49 0 .705.275.647.823-.029.331-.244.814-.646 1.449-.403.635-.705.952-.905.952-.259 0-.496-.489-.712-1.467-.072-.287-.201-1.02-.388-2.2-.172-1.093-.632-1.604-1.38-1.532-.315.03-.79.316-1.422.862-.46.417-.927.833-1.4 1.25l.45.581c.431-.3.682-.452.754-.452.33 0 .638.517.925 1.55l.775 2.84c.387 1.034.86 1.55 1.42 1.55.903 0 2.008-.848 3.313-2.544 1.262-1.624 1.915-2.904 1.958-3.838z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="video-icon" viewbox="0 0 64 64">
                                            <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                            <path d="M28 40V25l11 7.5L28 40z" fill="var(--icon-fill)" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                                        </symbol>
                                        <symbol id="youtube-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8c0-4.418 3.528-8 7.88-8s7.88 3.582 7.88 8-3.528 8-7.88 8S0 12.418 0 8zm11.982-1.61s-.082-.601-.334-.866c-.32-.347-.677-.349-.84-.369-1.175-.088-2.937-.088-2.937-.088h-.004s-1.762 0-2.936.088c-.165.02-.522.022-.842.37-.251.264-.333.865-.333.865s-.084.705-.084 1.411v.662c0 .705.084 1.411.084 1.411s.082.6.333.865c.32.348.74.337.926.373.672.067 2.854.088 2.854.088s1.764-.003 2.938-.091c.164-.02.522-.022.841-.37.252-.264.334-.865.334-.865s.084-.706.084-1.411V7.8c0-.706-.084-1.411-.084-1.411zm-4.98 2.874v-2.45l2.268 1.23-2.268 1.22z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="pinterest-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm-2.63-1.07h.47c.3-.49.74-1.28.9-1.9l.46-1.73c.23.45.92.83 1.66.83 2.18 0 3.76-2 3.76-4.5 0-2.4-1.95-4.2-4.47-4.2-3.13 0-4.79 2.1-4.79 4.4 0 1.06.57 2.38 1.47 2.8.14.07.21.04.24-.1l.2-.81a.22.22 0 0 0-.04-.21 2.82 2.82 0 0 1-.54-1.66c0-1.6 1.2-3.14 3.27-3.14 1.78 0 3.03 1.2 3.03 2.95 0 1.96-1 3.32-2.28 3.32-.71 0-1.25-.6-1.08-1.31.21-.87.6-1.8.6-2.42 0-.56-.3-1.02-.91-1.02-.73 0-1.31.75-1.31 1.76 0 .64.21 1.08.21 1.08l-.85 3.6a8.15 8.15 0 0 0 0 2.26z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="snapchat-icon" viewbox="0 0 16 16">
                                            <rect height="14" rx="8" ry="8" style="fill:var(--background-fill)" width="14" x="1" y="1"></rect>
                                            <path d="M0 8c0-4.42 3.53-8 7.88-8a7.94 7.94 0 0 1 7.88 8c0 4.42-3.53 8-7.88 8A7.94 7.94 0 0 1 0 8zm7.95-4h-.17c-.18 0-.55.03-.96.2A2.14 2.14 0 0 0 5.7 5.37c-.19.43-.14 1.15-.1 1.73v.19a.32.32 0 0 1-.13.02.9.9 0 0 1-.38-.1.33.33 0 0 0-.14-.03.5.5 0 0 0-.25.07.35.35 0 0 0-.18.23c0 .06 0 .18.12.3a.9.9 0 0 0 .31.18l.13.05c.15.05.39.12.45.27.03.07.02.17-.04.29a2.82 2.82 0 0 1-.94 1.13c-.22.15-.46.24-.71.28a.2.2 0 0 0-.17.21l.02.09c.04.1.14.17.29.25.18.08.46.16.82.21l.05.19.05.2c.02.07.08.16.22.16.06 0 .12 0 .2-.02a2.15 2.15 0 0 1 .75-.03c.2.04.38.16.59.31a1.89 1.89 0 0 0 1.26.46c.52 0 .86-.24 1.16-.46.2-.15.38-.27.59-.3a1.9 1.9 0 0 1 .75.01l.2.03c.11 0 .2-.06.22-.17l.05-.2.05-.18c.36-.05.64-.13.82-.21.15-.08.24-.16.28-.25a.26.26 0 0 0 .03-.09.2.2 0 0 0-.17-.2c-1.12-.2-1.63-1.36-1.65-1.41v-.01c-.06-.12-.07-.22-.04-.3.06-.14.3-.21.45-.26l.12-.05a.94.94 0 0 0 .34-.2c.08-.09.1-.18.1-.23 0-.14-.1-.26-.27-.32a.48.48 0 0 0-.18-.03.4.4 0 0 0-.17.03.95.95 0 0 1-.35.1.31.31 0 0 1-.12-.02l.01-.17V7.1a4.3 4.3 0 0 0-.1-1.73 2.2 2.2 0 0 0-.52-.74 2.2 2.2 0 0 0-1.57-.62z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol id="yelp-icon" viewbox="0 0 22 23">
                                            <path clip-rule="evenodd" d="M11 .876c-6.001 0-11 4.999-11 11 0 6.002 4.999 11 11 11s11-4.998 11-11c0-6.001-4.999-11-11-11z" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                            <path clip-rule="evenodd" d="M10.636 4.94a6.049 6.049 0 0 0-2.505.737c-.397.215-.444.455-.208.853.82 1.38 1.64 2.76 2.465 4.138.086.144.19.284.31.395.298.275.675.157.78-.245.033-.13.042-.268.05-.387l.01-.133-.09-1.421c-.071-1.137-.142-2.254-.215-3.37-.029-.443-.177-.593-.597-.566zm2.35 7.374a.766.766 0 0 0 .107-.018l.554-.146c.681-.18 1.362-.36 2.042-.546.38-.103.502-.332.364-.724a4.9 4.9 0 0 0-1.185-1.881c-.287-.283-.54-.251-.771.08-.36.51-.716 1.025-1.072 1.54-.18.261-.36.522-.542.783a.54.54 0 0 0-.039.587c.103.204.264.323.5.33l.042-.005zm-2.88-.142c.257.112.37.305.36.587-.012.267-.136.436-.403.526l-.215.073c-.785.266-1.57.532-2.356.79-.342.112-.557-.011-.634-.386-.089-.757-.035-1.824.054-2.242.098-.462.34-.577.752-.402.816.348 1.63.7 2.443 1.054zm5.752 2.243-.562-.2c-.697-.247-1.394-.495-2.092-.74-.215-.076-.402-.008-.545.175-.15.191-.216.414-.087.638.501.87 1.009 1.736 1.522 2.598.124.209.321.254.534.146a1.11 1.11 0 0 0 .253-.177 5.28 5.28 0 0 0 1.18-1.602c.039-.082.064-.171.09-.26l.036-.123c-.012-.242-.127-.383-.329-.454zm-4.691-.313c.223.094.326.258.327.538.002.338.002.677.001 1.016v.43h-.015v.436c.001.337.002.674-.002 1.011-.003.366-.18.561-.521.525a4.275 4.275 0 0 1-2.095-.815c-.285-.208-.308-.475-.087-.758.584-.748 1.174-1.49 1.766-2.23.166-.208.387-.254.626-.153z" fill-rule="evenodd" style="fill:var(--background-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="cash-app-logo-icon" viewbox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C20 4.56 20 6.24 20 9.6v.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C15.44 20 13.76 20 10.4 20h-.8c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 15.44 0 13.76 0 10.4v-.8z" fill="var(--color-cash-app)"></path>
                                            <path clip-rule="evenodd" d="M10.52 6.853c1.036 0 2.029.42 2.678.995.164.146.41.145.564-.01l.772-.784a.403.403 0 0 0-.02-.587 6.105 6.105 0 0 0-2.07-1.164l.243-1.153a.405.405 0 0 0-.396-.488H10.8a.405.405 0 0 0-.396.32l-.218 1.026c-1.983.1-3.665 1.089-3.665 3.12 0 1.758 1.391 2.511 2.86 3.033 1.39.521 2.124.715 2.124 1.449 0 .753-.733 1.197-1.816 1.197-.986 0-2.02-.325-2.821-1.116a.403.403 0 0 0-.566-.001l-.83.818a.407.407 0 0 0 .002.582c.647.628 1.467 1.082 2.401 1.337l-.227 1.068a.405.405 0 0 0 .393.49l1.494.01a.404.404 0 0 0 .399-.321l.216-1.027c2.375-.147 3.828-1.438 3.828-3.327 0-1.739-1.448-2.473-3.207-3.072-1.004-.367-1.874-.618-1.874-1.371 0-.734.812-1.024 1.623-1.024z" fill="#fff" fill-rule="evenodd"></path>
                                        </symbol>
                                        <symbol fill="none" id="square-pay-logo-icon" viewbox="0 0 52 19" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="19" width="52" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M14.159 0H2.84A2.84 2.84 0 0 0 0 2.84v11.318A2.842 2.842 0 0 0 2.841 17H14.16A2.842 2.842 0 0 0 17 14.158V2.84A2.84 2.84 0 0 0 14.159 0zm-.25 13.013a.896.896 0 0 1-.896.896H3.989a.897.897 0 0 1-.896-.896V3.988a.896.896 0 0 1 .896-.897h9.024a.897.897 0 0 1 .896.897v9.025z" fill="var(--icon-fill)"></path>
                                                <path d="M6.694 10.806a.514.514 0 0 1-.514-.516V6.687a.514.514 0 0 1 .514-.517h3.612a.515.515 0 0 1 .514.517v3.603a.516.516 0 0 1-.514.516H6.694z" fill="var(--icon-fill)"></path>
                                                <path d="M23.744 15.5v-4.716h2.178c2.934 0 4.59-1.35 4.59-3.942S28.856 2.9 25.922 2.9h-4.626v12.6h2.448zm0-10.548h2.25c1.26 0 2.088.648 2.088 1.89s-.828 1.89-2.088 1.89h-2.25v-3.78zM34.865 15.68c1.386 0 2.286-.648 2.736-1.728h.145V15.5h2.213V8.804c0-1.944-1.404-2.988-3.96-2.988-2.088 0-3.672 1.116-3.924 2.916h2.268c.162-.738.792-1.152 1.656-1.152.99 0 1.602.54 1.602 1.386v.846l-2.231.162c-2.197.162-3.492 1.152-3.492 2.952 0 1.62 1.206 2.754 2.987 2.754zm.756-1.728c-.846 0-1.35-.504-1.35-1.206 0-.72.505-1.206 1.512-1.278l1.819-.144v.396c0 1.332-.792 2.232-1.98 2.232zm8.382 4.932c1.764 0 2.754-.612 3.402-2.448l3.618-10.44h-2.232l-1.8 5.472-.342 1.332h-.144l-.324-1.332-1.836-5.472h-2.358l3.528 9.612-.18.504c-.234.594-.612.828-1.386.828h-1.332v1.944h1.386z" fill="var(--icon-fill)" fill-opacity=".95"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="close-icon" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <rect height="20.587" rx=".936" style="fill:var(--icon-fill)" transform="scale(.99243 1.00751) rotate(45 4.622 24.714)" width="1.872"></rect>
                                            <rect height="20.587" rx=".936" style="fill:var(--icon-fill)" transform="matrix(-.70176 .71242 .70176 .71242 5.313 4)" width="1.872"></rect>
                                        </symbol>
                                        <symbol fill="none" id="shopping-bag-icon" viewbox="0 0 33 33">
                                            <circle cx="16.5" cy="16.5" fill="var(--background-fill)" fill-opacity=".4" r="16.5"></circle>
                                            <path clip-rule="evenodd" d="M14.836 15a1 1 0 0 1-2 0h1-1v-.026l.001-.065a24.537 24.537 0 0 1 .054-1.273h-2.143L10 23.134h12.673l-.748-9.498h-2.143a29.311 29.311 0 0 1 .05 1.038l.004.236V14.998l-1 .001h1a1 1 0 0 1-2 0v-.067l-.004-.208a22.363 22.363 0 0 0-.055-1.089h-2.881a23.613 23.613 0 0 0-.059 1.297V15zm.305-3.364h2.391c-.15-.823-.359-1.56-.632-2.07-.287-.537-.493-.566-.563-.566-.071 0-.277.03-.564.566-.273.51-.483 1.246-.632 2.07zm4.42 0h2.364a2 2 0 0 1 1.994 1.843l.748 9.498a2 2 0 0 1-1.994 2.157H10a2 2 0 0 1-1.994-2.157l.748-9.498a2 2 0 0 1 1.994-1.843h2.364c.016-.103.034-.207.053-.312.162-.91.419-1.908.845-2.702C14.425 7.846 15.157 7 16.337 7c1.179 0 1.91.846 2.326 1.622.426.794.683 1.792.845 2.702.019.104.037.209.053.312z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                        </symbol>
                                        <symbol fill="none" id="ellipse-icon" viewbox="0 0 4 4" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="4" width="4" xmlns="http://www.w3.org/2000/svg">
                                                <circle cx="2" cy="2" fill="var(--icon-fill)" r="2"></circle>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="tag-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path clip-rule="evenodd" d="M15.707 5.107c.777-.776 2.05-1.564 3.488-2.158C20.63 2.356 22.122 2 23.3 2H34c2.188 0 4 1.691 4 3.9v10.7c0 1.166-.374 2.625-.992 4.052-.615 1.418-1.429 2.707-2.226 3.552l-8.05 8.114L7.615 13.2l8.092-8.093zM6.2 14.614l19.124 19.123-3.131 3.156-.001.001a3.889 3.889 0 0 1-5.485-.001l-.005-.006-.025-.025-.099-.1-.374-.377-1.352-1.363-4.23-4.264a4953.029 4953.029 0 0 0-7.515-7.565 3.889 3.889 0 0 1 0-5.486L6.2 14.614zm9.09 23.69L16 37.6l-.71.704-.002-.002-.007-.007-.025-.025-.098-.099-.374-.378-1.352-1.362-4.23-4.264a4998 4998 0 0 0-7.509-7.56 5.889 5.889 0 0 1 0-8.314l12.6-12.6c1.023-1.024 2.55-1.936 4.138-2.592C20.019.444 21.778 0 23.3 0H34c3.211 0 6 2.509 6 5.9v10.7c0 1.534-.477 3.275-1.158 4.848-.684 1.577-1.617 3.084-2.617 4.14l-.016.016-12.6 12.7-.003.003a5.889 5.889 0 0 1-8.314 0l-.003-.003zM35 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="digital-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M35 8h.974a.974.974 0 0 0-.285-.689l-.69.689zm-7-7 .689-.689a.974.974 0 0 0-.69-.285V1zm6 33.026H10v1.948h24v-1.948zm-24 0c-.042 0-.06-.007-.06-.007s.003 0 .008.004a.1.1 0 0 1 .03.03l.003.007s-.007-.018-.007-.06H8.026c0 .521.178 1.032.56 1.414.382.382.893.56 1.414.56v-1.948zM9.974 34V2H8.026v32h1.948zm0-32 .001-.011c-.001.003-.001.002.002-.002a.058.058 0 0 1 .018-.01c.007-.003.01-.003.005-.003V.026C9.026.026 8.026.8 8.026 2h1.948zm24.051 32v.011c0-.003.001-.002-.002.002a.06.06 0 0 1-.018.01c-.007.003-.01.003-.005.003v1.948c.974 0 1.974-.774 1.974-1.974h-1.949zm1.95 0V8h-1.95v26h1.95zm-.286-26.689-7-7-1.378 1.378 7 7 1.378-1.378zM27.999.026H10v1.948h18V.026z" fill="var(--icon-fill)"></path>
                                                <path d="M28 1v7h7" stroke="var(--icon-fill)" stroke-linejoin="round" stroke-width="1.949"></path>
                                                <path d="M31 37.998h.974a.974.974 0 0 1-.069.36l-.905-.36zM8.5 3.924a.974.974 0 1 1 0 1.949V3.924zM6 5.873a.18.18 0 0 0-.058.007l.007-.005a.1.1 0 0 0 .03-.029l.003-.006s-.007.02-.007.061h-1.95c0-.521.178-1.032.56-1.415.382-.383.893-.562 1.415-.562v1.949zm-.025.028v32.097h-1.95V5.901h1.95zm0 32.097v.012c0 .001 0 .001 0 0l.004.004a.06.06 0 0 0 .017.01c.007.003.009.003.004.003v1.948c-.976 0-1.974-.778-1.974-1.977h1.949zm.025.029h24v1.948H6v-1.948zm24 0c-.132 0-.2.056-.186.046a.657.657 0 0 0 .112-.131 1.808 1.808 0 0 0 .17-.31c.001 0 .001 0 0 0v.004c-.001 0-.001.001.904.362l.905.361v.002l-.002.002a.374.374 0 0 1-.002.006l-.007.017a2.646 2.646 0 0 1-.094.203 3.73 3.73 0 0 1-.276.468 2.54 2.54 0 0 1-.52.559 1.64 1.64 0 0 1-1.004.36v-1.95zm1-.029h-.974v-3.009h1.948v3.009H31zM6 3.924h2.5v1.949H6V3.924z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="service-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m15 8 .74.673a1 1 0 0 0-.033-1.38L15 8zM5 19l-.707.707a1 1 0 0 0 1.447-.034L5 19zm-3-3-.74-.673a1 1 0 0 0 .033 1.38L2 16zM12 5l.707-.707a1 1 0 0 0-1.447.034L12 5zm13 3-.707-.707a1 1 0 0 0-.033 1.38L25 8zm10 11-.74.673a1 1 0 0 0 1.447.034L35 19zm3-3 .707.707a1 1 0 0 0 .033-1.38L38 16zM28 5l.74-.673a1 1 0 0 0-1.447-.034L28 5zM9 28.9l-.707.707.049.046L9 28.9zm0-2.8-.707-.707L9 26.1zm3.5-3.5.707.707-.707-.707zm4.9 11.9-.707-.707a.994.994 0 0 0-.046.049l.753.658zm11.8-5.6.707-.707a1.075 1.075 0 0 0-.026-.026l-.68.733zM32 26l.753-.659a.994.994 0 0 0-.046-.048L32 26zm-1.793-3.207a1 1 0 0 0-1.414 1.414l1.414-1.414zm-3.1 8.2a1 1 0 0 0-1.414 1.414l1.415-1.414zm1.374-4.126a1 1 0 0 0-1.361 1.466l1.36-1.466zm-6.774 4.426a1 1 0 0 0-1.414 1.414l1.414-1.414zM26 34.7l-.573-.82a.995.995 0 0 0-.027.02l.6.8zm.3-3-.733.68.026.027.707-.707zm-.567-2.08a1 1 0 0 0-1.466 1.36l1.466-1.36zM6.707 17.293a1 1 0 0 0-1.414 1.414l1.414-1.414zm3.586 6.414a1 1 0 0 0 1.414-1.414l-1.414 1.414zM19 16l-.287-.958a.507.507 0 0 0-.018.006L19 16zm4 1 .707-.707a1.011 1.011 0 0 0-.082-.074L23 17zm-8.74-9.673-10 11 1.48 1.346 10-11-1.48-1.346zM5.707 18.293l-3-3-1.414 1.414 3 3 1.414-1.414zm-2.967-1.62 10-11-1.48-1.346-10 11 1.48 1.346zm8.553-10.966 3 3 1.414-1.414-3-3-1.414 1.414zM24.26 8.673l10 11 1.48-1.346-10-11-1.48 1.346zm11.447 11.034 3-3-1.414-1.414-3 3 1.414 1.414zm3.033-4.38-10-11-1.48 1.346 10 11 1.48-1.346zM27.293 4.293l-3 3 1.414 1.414 3-3-1.414-1.414zm-17.585 23.9c-.41-.41-.41-.976 0-1.386l-1.415-1.414c-1.19 1.19-1.19 3.024 0 4.214l1.415-1.414zm0-1.386 3.5-3.5-1.415-1.414-3.5 3.5 1.415 1.414zm3.5-3.5c.409-.41.976-.41 1.385 0l1.415-1.414c-1.191-1.19-3.024-1.19-4.215 0l1.415 1.414zm1.385 0c.41.41.41.976 0 1.386l1.415 1.414c1.19-1.19 1.19-3.024 0-4.214l-1.415 1.414zm0 1.386-3.5 3.5 1.415 1.414 3.5-3.5-1.415-1.414zm-3.451 3.454a1.13 1.13 0 0 1-1.483 0l-1.317 1.506a3.13 3.13 0 0 0 4.117 0l-1.317-1.506zm1.365 2.846c-.409-.41-.41-.976 0-1.386l-1.414-1.414c-1.19 1.19-1.19 3.023 0 4.214l1.414-1.414zm3.5-4.886c.41-.41.977-.41 1.386 0l1.414-1.414c-1.19-1.19-3.023-1.19-4.214 0l1.415 1.414zm1.386 0c.41.41.41.977 0 1.386l1.414 1.414c1.19-1.19 1.19-3.023 0-4.214l-1.414 1.414zm0 1.386-3.5 3.5 1.414 1.414 3.5-3.5-1.414-1.414zm-3.545 3.549c-.277.316-.903.388-1.34-.05l-1.415 1.415c1.162 1.163 3.137 1.235 4.26-.048l-1.505-1.318zm1.46 2.751c-.41-.41-.41-.976 0-1.386l-1.415-1.414c-1.19 1.19-1.19 3.024 0 4.214l1.414-1.414zm3.5-4.886c.409-.41.975-.41 1.385 0l1.414-1.414c-1.19-1.19-3.023-1.19-4.214 0l1.414 1.414zm1.385 0c.41.41.41.977 0 1.386l1.414 1.414c1.19-1.19 1.19-3.024 0-4.214l-1.414 1.414zm0 1.386-3.5 3.5 1.414 1.414 3.5-3.5-1.414-1.414zm-3.546 3.549c-.277.316-.902.389-1.34-.049l-1.414 1.414c1.162 1.163 3.137 1.235 4.26-.048l-1.506-1.317zm11.846-4.235c1.19 1.19 3.024 1.19 4.214 0l-1.414-1.414c-.41.41-.976.41-1.386 0l-1.414 1.414zm4.214 0c1.374-1.373.99-3.187.046-4.265l-1.505 1.317c.456.52.472 1.107.045 1.534l1.414 1.414zm0-4.314-2.5-2.5-1.414 1.414 2.5 2.5 1.414-1.414zm-7.014 7.114c1.19 1.19 3.024 1.19 4.214 0l-1.414-1.414c-.41.41-.976.41-1.385 0l-1.415 1.414zm4.214 0c1.191-1.19 1.19-3.024 0-4.214l-1.414 1.414c.41.41.41.977 0 1.386l1.415 1.414zm-.026-4.24-1.4-1.3-1.361 1.466 1.4 1.3 1.36-1.466zm-9.588 4.54 2.4 2.4 1.414-1.414-2.4-2.4-1.414 1.414zm2.4 2.4c.97.97 2.623 1.356 3.907.393l-1.2-1.6c-.316.237-.863.223-1.293-.207l-1.414 1.414zm3.88.412c1.508-1.055 1.676-3.284.434-4.526l-1.414 1.414c.358.359.326 1.129-.166 1.474l1.146 1.638zm.46-4.5-1.3-1.4-1.466 1.361 1.3 1.4 1.466-1.36zM5.293 18.708l5 5 1.414-1.414-5-5-1.414 1.414zM26 9l-.707-.707h-.001v.001h-.001v.001l-.001.001-.001.001h-.001v.001l-.001.001h-.001V8.3l-.002.001v.001h-.001l-.001.002-.002.002-.002.002-.002.002h-.001a.13.13 0 0 0-.006.007l-.002.001v.002l-.002.001-.002.002a.103.103 0 0 0-.004.004l-.002.002-.001.001-.002.002-.002.001-.001.002-.002.002-.002.002-.002.001c0 .001 0 .002-.002.002l-.001.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.003.002-.002.003-.002.002-.002.002-.003.002-.002.003-.002.002-.002.002a.272.272 0 0 0-.005.005l-.003.003-.002.002-.003.003-.002.002-.003.003-.002.002-.003.003-.003.003-.003.002-.002.003-.003.003-.003.002-.003.003-.002.003-.003.003a.072.072 0 0 0-.003.003l-.003.003a.073.073 0 0 0-.003.003l-.003.003-.003.003a.853.853 0 0 0-.003.003l-.003.003-.003.003a.1.1 0 0 1-.003.003l-.003.003-.003.003-.003.003-.003.003a.493.493 0 0 0-.007.007l-.003.003a.108.108 0 0 1-.007.007l-.003.003a1956203611.42 1956203611.42 0 0 0-.007.007l-.003.003-.004.004-.003.003-.004.003c0 .002-.002.003-.003.004l-.004.004a1.197 1.197 0 0 0-.003.003l-.004.004-.003.003-.004.004-.004.003c0 .002-.002.003-.003.004a.117.117 0 0 0-.008.008l-.004.003-.003.004-.004.004-.004.004-.004.003c0 .002-.002.003-.003.004a1.407 1.407 0 0 0-.004.004l-.004.004a.717.717 0 0 0-.004.004l-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004a.152.152 0 0 1-.008.008l-.004.004-.004.004-.004.004-.004.004a.16.16 0 0 0-.005.004c0 .002-.002.003-.004.005l-.004.004-.004.004-.004.004-.005.004-.004.005-.004.004a.175.175 0 0 1-.005.004c0 .002-.002.003-.004.005l-.004.004-.005.004c0 .002-.002.003-.004.005l-.004.004-.005.004-.004.005a.167.167 0 0 0-.004.004l-.005.005-.005.004-.004.005a1.916 1.916 0 0 0-.005.004l-.004.005-.005.004-.004.005-.005.004-.004.005-.005.005-.005.004-.004.005-.005.005-.004.004a.173.173 0 0 0-.005.005l-.005.005a.208.208 0 0 0-.01.009c0 .002-.002.003-.004.005a.21.21 0 0 0-.005.005l-.005.004-.004.005-.005.005-.005.005-.005.005-.005.004a.225.225 0 0 0-.004.005l-.005.005a.205.205 0 0 0-.005.005l-.005.005-.005.005-.005.005-.005.005-.005.004-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005a2.416 2.416 0 0 0-.005.005l-.005.006a1.215 1.215 0 0 0-.005.005l-.005.005a2.445 2.445 0 0 0-.01.01l-.005.005a2.467 2.467 0 0 0-.005.005l-.005.005-.006.005-.005.005-.005.006-.005.005-.005.005-.005.005-.006.005-.005.006-.005.005-.005.005a.233.233 0 0 0-.005.005l-.006.005-.005.006-.005.005-.005.005-.006.005a.294.294 0 0 1-.005.006l-.005.005a.265.265 0 0 0-.021.021l-.006.006-.005.005a.265.265 0 0 1-.01.01l-.006.006a.266.266 0 0 1-.016.016l-.006.005a.242.242 0 0 0-.005.006l-.005.005-.006.005-.005.006a2.742 2.742 0 0 0-.016.016l-.005.005-.006.006-.005.005-.006.006-.005.005a2.765 2.765 0 0 1-.006.005l-.005.006-.005.005a.283.283 0 0 0-.006.006l-.005.005-.006.006-.005.005-.006.005-.005.006-.005.005-.006.006a.284.284 0 0 0-.005.005l-.006.006a.284.284 0 0 0-.005.005l-.006.006-.005.005a.284.284 0 0 1-.011.01l-.006.006-.005.006-.005.005-.006.006a2.803 2.803 0 0 1-.005.005l-.006.006-.005.005-.006.006-.005.005-.006.006a.284.284 0 0 0-.01.01l-.006.006-.006.005-.005.006-.006.005-.005.006-.005.005a.284.284 0 0 1-.006.006l-.005.005-.006.006-.005.005a.284.284 0 0 1-.006.005l-.005.006a.284.284 0 0 1-.006.005l-.005.006-.005.005-.006.006-.005.005-.006.006a.283.283 0 0 1-.005.005l-.006.005a2.765 2.765 0 0 1-.005.006l-.005.005-.006.006a2.757 2.757 0 0 1-.005.005l-.006.005-.005.006-.005.005-.006.006-.005.005-.006.005-.005.006-.005.005a.267.267 0 0 1-.006.006l-.005.005a.266.266 0 0 0-.005.005l-.006.006a.242.242 0 0 0-.005.005l-.006.005-.005.006a2.696 2.696 0 0 1-.005.005l-.005.005-.006.006-.005.005-.005.005-.006.006-.005.005-.005.005a.264.264 0 0 1-.006.005l-.005.006-.005.005a.24.24 0 0 1-.005.005l-.006.005-.005.006-.005.005-.005.005-.006.005-.005.006-.005.005-.005.005-.005.005a.231.231 0 0 1-.005.005l-.006.005-.005.006-.005.005a.253.253 0 0 1-.005.005l-.005.005-.005.005-.005.005-.006.005a2.445 2.445 0 0 1-.005.005l-.005.005-.005.006-.005.005-.005.005a2.402 2.402 0 0 1-.015.015l-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.004-.005.005-.005.005-.004.005-.005.005-.005.005a.205.205 0 0 1-.01.01l-.005.004a2.179 2.179 0 0 1-.014.015l-.005.005-.005.004-.004.005-.005.005a2.119 2.119 0 0 1-.01.01l-.004.004-.005.005-.005.004-.004.005-.005.005-.004.004a.181.181 0 0 1-.01.01l-.004.004a.18.18 0 0 1-.005.004l-.004.005a1.922 1.922 0 0 1-.005.005l-.004.004-.005.004-.004.005-.005.004-.004.005a.183.183 0 0 1-.005.004c0 .002-.002.003-.004.005a.182.182 0 0 1-.004.004l-.005.004-.004.005-.004.004-.005.004-.004.005-.004.004-.005.004c0 .002-.002.003-.004.004l-.004.005-.004.004-.004.004-.005.004c0 .002-.002.003-.004.004l-.004.005-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004a8491334680.957 8491334680.957 0 0 1-.008.008l-.004.004-.004.004-.004.004-.004.003c0 .002-.002.003-.003.004l-.004.004-.004.004-.004.004-.004.003c0 .002-.002.003-.003.004l-.004.004a3633073655.432 3633073655.432 0 0 0-.008.007c0 .002-.002.003-.003.004l-.004.004-.003.003-.004.004-.004.003-.003.004-.003.003-.004.004-.003.003-.004.004a3250884297.246 3250884297.246 0 0 0-.01.01l-.003.003-.004.004-.003.003-.003.003-.004.003a2716058231.859 2716058231.859 0 0 1-.006.007l-.003.003-.003.003-.003.003-.004.003-.003.004-.003.003-.003.003-.003.003-.003.002c0 .002-.002.002-.003.003l-.003.003-.002.003-.003.003-.003.003-.003.003-.003.003-.003.002-.002.003-.003.003-.003.002-.002.003-.003.003-.002.002-.003.003-.003.002-.002.003-.003.002-.002.003-.002.002-.003.002-.002.003-.002.002-.003.002-.002.003-.002.002-.002.002-.003.002-.002.003-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.001.001-.002.002-.002.002 1.414 1.414.002-.002.002-.002.002-.001.001-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002.003-.002.002-.003.002-.002.002-.002.002-.002.003-.003.002-.002.003-.002.002-.003.002-.002.003-.002.002-.003.003-.003.002-.002.003-.003.002-.002.003-.003.003-.002.002-.003.003-.003.003-.002a.037.037 0 0 0 .003-.003l.002-.003.003-.003.003-.003.003-.003.003-.002a.08.08 0 0 1 .003-.003l.003-.003.003-.003.003-.003.003-.003a.09.09 0 0 1 .006-.006l.003-.004.003-.003a.092.092 0 0 1 .003-.003l.003-.003.003-.003.004-.003c0-.002.002-.003.003-.004l.003-.003.003-.003a2889930025.631 2889930025.631 0 0 1 .007-.007l.003-.003a.055.055 0 0 1 .004-.004l.003-.003.004-.003c0-.002.002-.003.003-.004l.004-.003c0-.002.002-.003.003-.004l.004-.004a3439172743.957 3439172743.957 0 0 0 .007-.007l.003-.003.004-.004.004-.003.003-.004.004-.004.004-.004a.13.13 0 0 1 .004-.003c0-.002.002-.003.003-.004l.004-.004.004-.004.004-.004.004-.003c0-.002.002-.003.004-.004 0-.002.002-.003.003-.004a.149.149 0 0 1 .008-.008l.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004.005-.004c0-.002.002-.003.004-.004l.004-.005.004-.004.004-.004.004-.004.005-.004a.172.172 0 0 1 .008-.009l.004-.004.005-.004.004-.005.004-.004.005-.004a.18.18 0 0 1 .004-.005l.004-.004.005-.005.004-.004.005-.004.004-.005.005-.004.004-.005.004-.004.005-.005a.197.197 0 0 1 .005-.004l.004-.005.005-.005a.197.197 0 0 1 .013-.013l.005-.005a3743849765.858 3743849765.858 0 0 0 .01-.01l.004-.004a.104.104 0 0 1 .01-.01l.004-.004.005-.005.005-.004.004-.005.005-.005.005-.005.005-.005.005-.004.004-.005.005-.005.005-.005.005-.005.005-.005.005-.005a.229.229 0 0 1 .01-.01l.005-.004.004-.005.005-.005a.233.233 0 0 1 .005-.005l.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005a.118.118 0 0 0 .005-.005l.006-.005.005-.005.005-.005.005-.005.005-.006.005-.005.005-.005a.253.253 0 0 1 .005-.005l.005-.005.005-.005.006-.005a.253.253 0 0 1 .005-.006l.005-.005.005-.005.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006.005-.005.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006a.267.267 0 0 1 .005-.005l.006-.005a.267.267 0 0 1 .005-.006l.005-.005a.267.267 0 0 1 .006-.005l.005-.006.006-.005.005-.006a.267.267 0 0 1 .005-.005l.006-.005.005-.006.005-.005.006-.006.005-.005.006-.005.005-.006.005-.005.006-.006.005-.005.006-.005.005-.006.006-.005.005-.006.005-.005a.143.143 0 0 0 .006-.006l.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006.005-.005.006-.006.005-.005.006-.006.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006.006-.005a.283.283 0 0 1 .005-.006l.005-.005.006-.006.005-.005a.283.283 0 0 1 .006-.006l.005-.005a.143.143 0 0 0 .006-.006l.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006.006-.005.005-.006.006-.005a.283.283 0 0 1 .005-.006l.005-.005.006-.006.005-.005a.283.283 0 0 1 .006-.005l.005-.006.006-.005.005-.006a.143.143 0 0 0 .006-.005l.005-.006.005-.005.006-.006.005-.005.006-.005.005-.006a.283.283 0 0 1 .006-.005l.005-.006.005-.005.006-.005.005-.006.006-.005.005-.006.005-.005.006-.005.005-.006.005-.005.006-.005.005-.006.006-.005a.267.267 0 0 1 .005-.006l.005-.005.005-.005.006-.006.005-.005a.267.267 0 0 1 .01-.01l.006-.006.005-.005.006-.005a.262.262 0 0 1 .01-.011l.006-.005.005-.006.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005.005-.005.006-.005.005-.006.005-.005.005-.005a.253.253 0 0 1 .005-.005l.006-.005a.253.253 0 0 1 .005-.005l.005-.006.005-.005a.253.253 0 0 1 .005-.005l.005-.005.005-.005.005-.005.005-.005.006-.005a.238.238 0 0 1 .005-.005l.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.005-.005.004-.005.005-.005.005-.005.005-.005.005-.005a.224.224 0 0 1 .005-.005l.005-.005.005-.004.004-.005.005-.005.005-.005.005-.005.005-.004.004-.005a.21.21 0 0 1 .01-.01l.004-.004.005-.005.005-.005a.206.206 0 0 1 .004-.004l.005-.005.005-.004.004-.005.005-.005.004-.004.005-.005.005-.004.004-.005.005-.004.004-.005.005-.005.004-.004.005-.005.004-.004.005-.004.004-.005.004-.004.005-.005.004-.004.004-.004.005-.005.004-.004.004-.004.005-.004.004-.005.004-.004.004-.004.005-.004c0-.002.002-.003.004-.004l.004-.005.004-.004.004-.004.004-.004.004-.004.004-.004.004-.004a.153.153 0 0 1 .004-.004l.004-.004a.149.149 0 0 1 .008-.008.136.136 0 0 1 .008-.008 8072996200.381 8072996200.381 0 0 0 .008-.008l.004-.004.004-.003c0-.002.002-.003.004-.004 0-.002.002-.003.003-.004l.004-.004.004-.004.003-.003.004-.004.004-.004a.626.626 0 0 1 .004-.003c0-.002.002-.003.003-.004l.004-.004.003-.003.004-.004a.116.116 0 0 1 .01-.01l.004-.004.004-.003a.1.1 0 0 1 .003-.004l.003-.003a.109.109 0 0 1 .004-.003c0-.002.002-.003.003-.004l.003-.003a1.031 1.031 0 0 1 .014-.013l.003-.003c0-.002.002-.003.003-.004a.096.096 0 0 0 .003-.003l.003-.003.003-.003.003-.003.003-.003a.866.866 0 0 1 .006-.006l.003-.003a.832.832 0 0 1 .003-.003l.003-.003.003-.003.003-.003.003-.003.003-.003.003-.002.002-.003.003-.003.003-.003.002-.002.003-.003.003-.002.002-.003.003-.003.002-.002.003-.003.002-.002.003-.003.002-.002.003-.002.002-.003.002-.002.003-.003.002-.002.002-.002.003-.002c0-.001 0-.002.002-.002l.002-.003.002-.002.002-.002.002-.002a.2.2 0 0 1 .002-.002l.002-.002.002-.002.002-.002.002-.002.002-.002.002-.002a.155.155 0 0 1 .003-.003l.002-.002.002-.002.002-.001.001-.002.002-.002.001-.001.002-.002.002-.001.001-.002.002-.001v-.002l.002-.001.002-.001.001-.002.001-.001.002-.001v-.002a.134.134 0 0 1 .004-.003l.001-.001.001-.001.001-.001.001-.001.001-.001.001-.001h.001v-.002h.002v-.001l.001-.001.002-.001v-.001l.001-.001.001-.001.001-.001h.001v-.001h.001L26 9zm-2.707 1.293c.173-.173.343-.193.27-.176a1.45 1.45 0 0 1-.208.026c-.234.018-.56.02-.949.007-.772-.024-1.67-.096-2.33-.147l-.153 1.994c.641.05 1.593.127 2.42.152.412.013.823.015 1.164-.011.169-.013.35-.035.52-.075.121-.029.432-.108.68-.356l-1.414-1.414zm-3.216-.29c-.515-.04-1.053.08-1.527.23-.489.155-.997.373-1.478.6-.482.229-.961.478-1.388.7-.437.229-.805.422-1.103.559l.838 1.816c.352-.163.771-.382 1.19-.601.43-.225.876-.456 1.319-.665.444-.21.86-.386 1.228-.503.383-.121.632-.152.767-.142l.154-1.994zm-5.496 2.089c-.692.32-1.356.747-1.664 1.414-.354.768-.096 1.494.235 2.024l1.696-1.06a.699.699 0 0 1-.1-.208c0-.002.001.01-.001.03a.181.181 0 0 1-.014.052c-.01.02.002-.019.112-.106.111-.088.292-.2.574-.33l-.838-1.816zm-1.429 3.438c.427.684 1.31 1.242 2.323 1.531 1.06.303 2.386.353 3.83-.109l-.61-1.904c-1.056.338-1.98.288-2.67.09-.737-.21-1.104-.552-1.177-.668l-1.696 1.06zm6.135 1.428c.677-.203 1.416-.047 2.065.235a5.393 5.393 0 0 1 1.018.584l.008.006h-.001v-.001h-.001L23 17c.625-.78.624-.781.624-.781l-.002-.002-.003-.002-.009-.007-.026-.02a6.368 6.368 0 0 0-.387-.27 7.42 7.42 0 0 0-1.05-.56c-.85-.369-2.111-.713-3.434-.316l.574 1.916zm3.006.75 8 8 1.414-1.415-8-8-1.414 1.414zm-9-8 3 3 1.414-1.415-3-3-1.414 1.414zm20 7.585-4.5 4.5 1.414 1.414 4.5-4.5-1.414-1.414z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="donation-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M2 19a1 1 0 1 0 0 2v-2zm36 2a1 1 0 1 0 0-2v2zM21 8a1 1 0 1 0-2 0h2zm-2 24a1 1 0 1 0 2 0h-2zm7-13.7-.676-.737a.892.892 0 0 0-.031.03L26 18.3zm-12 0 .708-.707a.986.986 0 0 0-.032-.03l-.675.737zm0 4.7a1 1 0 1 0 0 2v-2zm12 2a1 1 0 1 0 0-2v2zM2 21h36v-2H2v2zM19 8v24h2V8h-2zm6.293 9.593c-.099.099-.415.283-1.02.49-.559.193-1.23.361-1.892.501a32.888 32.888 0 0 1-2.491.422l-.01.001h-.001L20 20l.122.993h.001l.004-.001c.003 0 .007 0 .012-.002.01 0 .025-.003.044-.005a27.755 27.755 0 0 0 .752-.108 35.006 35.006 0 0 0 1.859-.336c.7-.148 1.46-.336 2.13-.566.623-.214 1.332-.517 1.783-.968l-1.414-1.414zM20 20l.925.38v-.002l.004-.008.013-.03.05-.121c.045-.105.11-.258.192-.445.163-.375.392-.885.654-1.427a23.39 23.39 0 0 1 .839-1.596c.297-.508.55-.864.73-1.044l-1.414-1.414c-.37.37-.73.914-1.042 1.447a25.492 25.492 0 0 0-.914 1.737 43.527 43.527 0 0 0-.957 2.13l-.004.01v.002l-.001.001L20 20zm3.407-4.293a2.28 2.28 0 0 1 1.328-.663c.446-.05.77.074.958.263l1.414-1.414c-.711-.712-1.688-.937-2.592-.837-.907.1-1.816.53-2.522 1.237l1.414 1.414zm2.286-.4c.404.405.515 1.446-.369 2.256l1.352 1.474c1.516-1.39 1.827-3.749.431-5.144l-1.414 1.414zm-12.4 3.7c.452.451 1.161.754 1.784.968.669.23 1.429.418 2.13.566a35.003 35.003 0 0 0 2.61.444l.044.005.012.002h.005L20 20l.122-.993h-.003l-.008-.001a4.733 4.733 0 0 1-.189-.025 32.903 32.903 0 0 1-2.303-.397 16.575 16.575 0 0 1-1.892-.5c-.605-.208-.92-.392-1.02-.491l-1.414 1.414zM20 20l.925-.38-.001-.003-.004-.01a5.06 5.06 0 0 0-.07-.165 43.862 43.862 0 0 0-.887-1.964 25.3 25.3 0 0 0-.914-1.738c-.312-.533-.67-1.077-1.041-1.447l-1.415 1.414c.18.18.433.536.73 1.044.287.488.577 1.053.84 1.596a41.814 41.814 0 0 1 .908 2.023l.003.008v.001L20 20zm-1.992-5.707a4.278 4.278 0 0 0-2.522-1.237c-.905-.1-1.881.126-2.593.837l1.415 1.414c.188-.189.512-.313.957-.263.444.05.935.27 1.328.663l1.415-1.414zm-5.114-.4c-1.396 1.395-1.085 3.754.43 5.144l1.352-1.474c-.884-.81-.773-1.851-.368-2.256l-1.415-1.414zM20 20l-.997-.076v-.01.01a2.68 2.68 0 0 1-.093.403 3.31 3.31 0 0 1-.558 1.054C17.778 22.11 16.585 23 14 23v2c3.115 0 4.922-1.11 5.923-2.381.485-.616.75-1.23.896-1.696a4.668 4.668 0 0 0 .169-.756 2.448 2.448 0 0 0 .009-.086v-.005L20 20zm0 0-.999.051v.005l.001.008.001.02a2.604 2.604 0 0 0 .029.24c.022.147.061.346.13.581.136.468.392 1.088.873 1.708C21.028 23.895 22.842 25 26 25v-2c-2.642 0-3.828-.895-4.385-1.613a3.15 3.15 0 0 1-.533-1.042 2.558 2.558 0 0 1-.083-.398v-.009.012L20 20zM6 32c-1.546 0-2.493-.386-3.063-.964C2.365 30.454 2 29.503 2 28H0c0 1.797.435 3.346 1.513 4.44C2.593 33.535 4.146 34 6 34v-2zm-4-4V12H0v16h2zm0-16c0-1.504.365-2.454.937-3.036C3.507 8.386 4.454 8 6 8V6c-1.854 0-3.407.464-4.487 1.56C.435 8.655 0 10.205 0 12h2zm4-4h28V6H6v2zm28 0c1.546 0 2.493.386 3.063.964.572.582.937 1.532.937 3.036h2c0-1.796-.435-3.346-1.513-4.44C37.407 6.465 35.854 6 34 6v2zm4 4v16h2V12h-2zm0 16c0 1.4-.477 2.35-1.217 2.97-.766.643-1.937 1.03-3.483 1.03v2c1.854 0 3.533-.462 4.767-1.496C39.327 31.45 40 29.901 40 28h-2zm-4.7 4H6v2h27.3v-2z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="event-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m22.3 17.1 4.7.9-3.3 3.4.6 4.6-4.3-2-4.3 2 .6-4.6L13 18l4.7-.9L20 13l2.3 4.1z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"></path>
                                                <path d="M38 33H2c-.6 0-1-.4-1-1V8c0-.6.4-1 1-1h36c.6 0 1 .4 1 1v24c0 .6-.4 1-1 1z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="membership-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M23 15a1 1 0 1 0 0 2v-2zm10 2a1 1 0 1 0 0-2v2zm-10 2a1 1 0 1 0 0 2v-2zm7 2a1 1 0 1 0 0-2v2zm-7 2a1 1 0 1 0 0 2v-2zm8 2a1 1 0 1 0 0-2v2zm-15.392.51a1 1 0 0 0 1.585-1.22l-1.585 1.22zm-9-1.22a1 1 0 0 0 1.585 1.22l-1.585-1.22zM37 32H3v2h34v-2zM3 32c-.548 0-1-.452-1-1H0c0 1.652 1.348 3 3 3v-2zm-1-1V9H0v22h2zM2 9c0-.548.452-1 1-1V6C1.348 6 0 7.348 0 9h2zm1-1h34V6H3v2zm34 0c.548 0 1 .452 1 1h2c0-1.652-1.348-3-3-3v2zm1 1v22h2V9h-2zm0 22c0 .548-.452 1-1 1v2c1.652 0 3-1.348 3-3h-2zM23 17h10v-2H23v2zm0 4h7v-2h-7v2zm0 4h8v-2h-8v2zm-9.1-7a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4h-2zm-2 2a2 2 0 0 1-2-2h-2a4 4 0 0 0 4 4v-2zm-2-2a2 2 0 0 1 2-2v-2a4 4 0 0 0-4 4h2zm2-2a2 2 0 0 1 2 2h2a4 4 0 0 0-4-4v2zm5.293 8.29c-1.184-1.539-3.173-2.59-5.293-2.59v2c1.48 0 2.891.748 3.708 1.81l1.585-1.22zM11.9 21.7c-2.12 0-4.109 1.051-5.292 2.59l1.585 1.22c.816-1.062 2.227-1.81 3.707-1.81v-2z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="food-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <g clip-path="url(#clip0)">
                                                    <path d="M14.293 21.85 1.758 34.132c-1.01.99-1.01 2.972 0 3.962 1.011.99 3.033.99 4.044 0l12.737-14.859m4.145-4.953c1.214-1.283 2.528-2.675 2.528-2.675 1.718 1.684 4.288 1.392 6.47-.693 2.18-2.086 5.812-6.747 6.065-7.33.253-.585.71-1.385 0-2.081a1.487 1.487 0 0 0-2.123 0m0 0c-.1.099-.1.099 0 0zm0 0c.607-.595.607-1.486 0-2.08a1.487 1.487 0 0 0-2.123 0m2.123 2.08s-3.942 3.92-6.124 6.124m4.001-8.204c-.1.099-.1.099 0 0zm0 0c.607-.595.607-1.486 0-2.08-.606-.595-1.367-.47-2.123 0-.755.468-7.48 5.943-7.48 5.943-1.82 1.486-2.427 4.656-.708 6.34 0 0-1.61 1.34-2.83 2.476M33.5 3.423s-1.001 1.077-6 6.001M3.78 1.442S37 32 38.15 33.142c1.152 1.142.81 4.061 0 4.953-.909.892-3.74 1.486-5.054 0L22.987 24.227c-.808-.991-3.74-.991-5.054-.991-1.416 0-3.235-.892-4.044-1.981L4.791 10.358C2.97 7.98 2.162 4.018 3.78 1.442z" stroke="var(--icon-fill)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                                                </g>
                                                <defs>
                                                    <clippath id="clip0">
                                                        <path d="M0 0h40v40H0z" fill="var(--background-fill)"></path>
                                                    </clippath>
                                                </defs>
                                            </svg>
                                        </symbol>
                                        <symbol fill="none" id="image-icon" viewbox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="64" width="64" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M64 32c0 17.673-14.327 32-32 32C14.327 64 0 49.673 0 32 0 14.327 14.327 0 32 0c17.673 0 32 14.327 32 32z" fill="var(--background-fill)"></path>
                                                <path clip-rule="evenodd" d="M28.372 28.25c1.196 0 2.166-1.007 2.166-2.25s-.97-2.25-2.166-2.25-2.166 1.007-2.166 2.25.97 2.25 2.166 2.25zm-1.288 3.913a1 1 0 0 0-1.562.154L21.42 38.71a1 1 0 0 0 .841 1.54h19.504a1 1 0 0 0 .857-1.515l-5.552-9.23a1 1 0 0 0-1.65-.094l-4.173 5.42a1 1 0 0 1-1.513.083l-2.649-2.752z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="section-icon" viewbox="0 0 16 16">
                                            <path d="M.667.057a.993.993 0 0 0-.66 1.021.96.96 0 0 0 .556.819l.201.099 7.174.008c6.45.007 7.19.003 7.336-.039.354-.103.576-.325.709-.708.052-.147.062-.42.019-.499a5.394 5.394 0 0 1-.09-.189 1.078 1.078 0 0 0-.482-.476l-.165-.078-7.22-.007C1.114.002.819.004.667.057m-.657.949c0 .115.005.159.012.097a1.238 1.238 0 0 0 0-.211C.015.839.01.89.01 1.006m.753 3.021a1.11 1.11 0 0 0-.557.368c-.219.291-.208.084-.199 3.665l.008 3.212.083.169c.097.198.298.395.497.487l.14.064 7.23.008 7.229.008.175-.071a.999.999 0 0 0 .597-.629c.064-.173.064-.184.064-3.354 0-2.101-.01-3.181-.03-3.181-.017 0-.03-.021-.03-.046 0-.136-.233-.451-.422-.57-.277-.175.223-.165-7.546-.161-4.21.002-7.167.014-7.239.031M.014 8c0 1.767.004 2.485.009 1.596.004-.888.004-2.334 0-3.212C.018 5.506.014 6.233.014 8m1.997 0v1.996h11.978V6.004H2.011V8M.832 14.02a1.028 1.028 0 0 0-.739.569c-.065.138-.078.208-.078.42 0 .213.013.283.078.421.093.196.287.395.476.488l.136.067 7.256.008 7.255.007.169-.063c.367-.137.645-.56.645-.981 0-.103-.01-.187-.023-.187s-.047-.068-.077-.151c-.073-.207-.32-.451-.55-.544l-.175-.07L8.09 14c-3.913-.003-7.179.006-7.258.02m-.822.989c0 .124.005.175.012.113a1.408 1.408 0 0 0 0-.225c-.007-.062-.012-.011-.012.112" fill-rule="evenodd" style="fill:var(--icon-fill)"></path>
                                        </symbol>
                                        <symbol fill="none" id="category-folder-icon" viewbox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                            <svg height="40" width="40" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M39 17a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4m14.5-8L11 5H2a1 1 0 0 0-1 1v27a2 2 0 0 0 2 2h34a2 2 0 0 0 2-2V10a1 1 0 0 0-1-1H15.5z" stroke="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="phone-icon" viewbox="0 0 16 16">
                                            <svg fill="none" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m9.606 9.333-.04.04-.035.044-.526.66A9.316 9.316 0 0 1 5.94 7.036l.683-.581.037-.032.034-.036a1.68 1.68 0 0 0 .394-1.673l-.002-.009-.003-.008A6.435 6.435 0 0 1 6.76 2.66C6.76 1.748 6.012 1 5.1 1H2.793c-.303 0-.716.063-1.087.311A1.585 1.585 0 0 0 1 2.66C1 9.406 6.601 15 13.34 15a1.59 1.59 0 0 0 1.326-.681c.253-.361.334-.774.334-1.106v-2.3c0-.912-.748-1.66-1.66-1.66-.71 0-1.397-.115-2.039-.322a1.652 1.652 0 0 0-1.695.402z" stroke="var(--icon-fill)" stroke-width="2"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="direction-icon" viewbox="0 0 21 21">
                                            <svg fill="none" height="21" width="21" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m19.71 10.29-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM12 13.5V11H8v3H6v-4c0-.55.45-1 1-1h5V6.5l3.5 3.5-3.5 3.5z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="map-icon" viewbox="0 0 20 19">
                                            <svg fill="none" height="19" width="20" xmlns="http://www.w3.org/2000/svg">
                                                <path d="m19.32 2.05-6-2h-.07a.7.7 0 0 0-.14 0h-.43L7 2 1.32.05a1 1 0 0 0-.9.14A1 1 0 0 0 0 1v14a1 1 0 0 0 .68.95l6 2a1 1 0 0 0 .62 0l5.7-1.9L18.68 18c.106.014.214.014.32 0a.94.94 0 0 0 .58-.19A1.001 1.001 0 0 0 20 17V3a1 1 0 0 0-.68-.95zM6 15.61l-4-1.33V2.39l4 1.33v11.89zm6-1.33-4 1.33V3.72l4-1.33v11.89zm6 1.33-4-1.33V2.39l4 1.33v11.89z" fill="var(--icon-fill)"></path>
                                            </svg>
                                        </symbol>
                                        <symbol id="list-icon" viewbox="0 0 24 24">
                                            <svg fill="none" height="24" width="24" xmlns="http://www.w3.org/2000/svg">
                                                <path clip-rule="evenodd" d="M3 2a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3zm1 18V4h16v16H4zM7 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm1 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm2-8a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-6zm-1 5a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1z" fill="var(--icon-fill)" fill-rule="evenodd"></path>
                                            </svg>
                                        </symbol>
                                    </svg>undefined
                                </div>undefined<div class="cko__footer cko--max-width">
                                    <div class="cko__footer-divider 📚19-4-0_q2yX" style="--divider-color: #797e83; --divider-size: 1px;"></div>undefined
                                </div>undefined</div>undefined
                        </div>undefined
                    </div>undefined
                </div>undefined<script>
                    // Get all the category elements
                    const categoryItems = document.querySelectorAll(".category-item");
                    // Function to hide all overlays
                    function hideAllOverlays() {
                        const overlays = document.querySelectorAll(".widget-overlay");
                        overlays.forEach(overlay => {
                            overlay.style.display = "none";
                        });
                    }
                    // Add click event listener to each category
                    categoryItems.forEach(categoryItem => {
                        categoryItem.addEventListener("click", function() {
                            // Hide all overlays
                            hideAllOverlays();
                            // Get the widget overlay within the clicked category
                            const widgetOverlay = categoryItem.querySelector(".widget-overlay");
                            // Display the clicked widget overlay
                            if (widgetOverlay) {
                                widgetOverlay.style.display = "flex";
                            }
                        });
                    });
                </script>undefined<script>
                    if (typeof customOverlayScriptLoaded === 'undefined') {
                        var customOverlayScriptLoaded = true;
                        console.log('Custom script for category overlays is loaded.');
                        // Get all the category elements
                        var uniqueCategoryItems = document.querySelectorAll(".category-item");
                        // Function to hide all overlays
                        function hideUniqueOverlays() {
                            console.log('Hiding all overlays.');
                            var uniqueOverlays = document.querySelectorAll(".category-image__overlay-fill");
                            uniqueOverlays.forEach(function(overlay) {
                                overlay.style.display = "none";
                            });
                        }
                        // Add click event listener to each category
                        uniqueCategoryItems.forEach(function(categoryItem) {
                            console.log('Adding click event listener to a category.');
                            categoryItem.addEventListener("click", function() {
                                console.log('A category was clicked.');
                                // Hide all overlays
                                hideUniqueOverlays();
                                // Get the widget overlay within the clicked category
                                var uniqueWidgetOverlay = categoryItem.querySelector(".category-image__overlay-fill");
                                // Display the clicked widget overlay
                                if (uniqueWidgetOverlay) {
                                    console.log('Displaying the overlay for the clicked category.');
                                    uniqueWidgetOverlay.style.display = "block";
                                }
                            });
                        });
                    }
                </script>undefined
            </body>undefined
    </html>