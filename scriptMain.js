gsap.registerPlugin(ScrollTrigger);

// ------------------------------------------------------------
// --- 1. LENIS INITIALIZATION (Smooth Momentum) ---
// ------------------------------------------------------------

const lenis = new Lenis({
    duration: 1.5, 
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
    direction: 'vertical',
    gestureDirection: 'vertical', 
    smoothWheel: true,
    smoothTouch: false, 
    autoRaf: true, 
})

function raf(time) {
    lenis.raf(time)
    requestAnimationFrame(raf)
}
requestAnimationFrame(raf)

// *** LENIS-SCROLLTRIGGER BRIDGE ***
// This connects Lenis's scroll position updates to ScrollTrigger
lenis.on('scroll', ScrollTrigger.update)

gsap.ticker.add((time)=>{
    lenis.raf(time * 1000)
})

ScrollTrigger.defaults({
    scroller: document.body 
});


document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        lenis.scrollTo(this.getAttribute('href'), {
            duration: 1.2,
            easing: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
        });
    });
});


// ------------------------------------------------------------
// --- 2. GSAP Animations (Header and Dynamic Flicker) ---
// ------------------------------------------------------------

// --- HEADER VISIBILITY LOGIC ---
// 1. Set initial state: hidden above the top and invisible
gsap.set("header", { y: "-100%", autoAlpha: 0 });

// 2. Create ScrollTrigger to reveal header the moment the user scrolls down 1 pixel
ScrollTrigger.create({
    trigger: document.body,
    start: "top top-=1", // Triggers the animation 1 pixel after the top of the page is reached
    end: "max", // Keep the trigger active until the very end of the page scroll
    
    animation: gsap.to("header", {
        y: "0%",
        autoAlpha: 1,
        duration: 0.5,
        ease: "power2.out"
    }),
    // Play when scrolling down past the trigger, Reverse when scrolling up past the trigger
    toggleActions: "play none none reverse" 
});


// Title Split and Header Animation
const titleContainer = document.querySelector(".flickering-text-container");
const titleText = titleContainer.textContent.trim();
let splitText = '';

for (let i = 0; i < titleText.length; i++) {
    const char = titleText[i];
    const className = char === ' ' ? 'whitespace' : 'letter';
    splitText += `<span class="${className}">${char}</span>`;
}
titleContainer.innerHTML = splitText;

// Simple Flicker-In Animation 
const letters = titleContainer.querySelectorAll(".letter");
const scrollCue = document.getElementById("scroll-to-explore"); // Target the cue

// --- Dynamic Flicker Logic (Monochromatic, Longer Duration) ---

// 1. Initial State: Set letters and cue to be fully transparent
gsap.set(letters, { opacity: 0, textShadow: 'none', color: '#fff' });
gsap.set(scrollCue, { autoAlpha: 0 }); // INITIAL HIDE CUE

const flickerTimeline = gsap.timeline({
    delay: 0.5,
    onComplete: () => {
        // Ensure final state is 100% visible, white, and has the intended dark shadow
        gsap.to(letters, { 
            opacity: 1, 
            textShadow: '1px 1px 3px rgba(0, 0, 0, 0.7)', 
            color: '#fff', 
            duration: 0.3, 
            ease: "power2.out" 
        });
        // Fade in the scroll cue after the flicker finishes
        gsap.to(scrollCue, { autoAlpha: 1, duration: 1.0, ease: "power2.out" }); 
    }
});

// 2. Define the Flicker Animation Logic
const numFlickerCycles = 10; 
const finalAppearanceTime = 1.0; 

for (let i = 0; i < numFlickerCycles; i++) {
    const timePosition = `start+=${(i / numFlickerCycles) * finalAppearanceTime}`;

    flickerTimeline.to(letters, {
        opacity: 0, 
        duration: () => gsap.utils.random(0.01, 0.03), 
        stagger: { each: 0.02, from: "random" }
    }, timePosition);

    flickerTimeline.to(letters, {
        opacity: 1, 
        textShadow: () => `0 0 ${gsap.utils.random(1, 3)}px #fff`, 
        duration: () => gsap.utils.random(0.02, 0.05), 
        stagger: { each: 0.02, from: "random" }
    }, `<-0.01`); 
}

flickerTimeline.to(letters, {
    opacity: 1,
    textShadow: 'none',
    duration: 0.1
}, '+=0.05'); 

// --- SCROLL PROGRESS BAR LOGIC ---
ScrollTrigger.create({
    trigger: document.body,
    start: "top top",
    end: "bottom bottom",
    scrub: 0.5,
    onUpdate: (self) => {
        gsap.to(".scroll-progress-bar", {
            width: self.progress * 100 + "%",
            ease: "none",
            duration: 0.05 // Tiny duration for smooth update
        });
    }
});

// ------------------------------------------------------------
// --- 3. SCROLLTRIGGER PINNING LOGIC ---
// ------------------------------------------------------------

// Get the element to pin and its container
const pinContainer = document.getElementById("pin-container");
const stickyElement = document.getElementById("sticky-element");

// Create the ScrollTrigger to pin the element
ScrollTrigger.create({
    trigger: pinContainer, 
    // Start pinning when the top of the pinContainer hits the top of the viewport
    start: "top top", 
    // End pinning after 200vh of scrolling past the start (Corrected from 1200vh)
    end: "+=200vh", 
    pin: stickyElement, // The element to make sticky
    pinSpacing: false, // Prevents adding padding to the scroller
    
    // Optional: Use scrub to smoothly transition a color while it's pinned
    scrub: true,
    animation: gsap.to(stickyElement, { 
        backgroundColor: "rgba(255, 165, 0, 0.4)", // Orange hue
        borderColor: "#ffa500", 
        scale: 1.05, 
        duration: 1
    })
});

// ------------------------------------------------------------
// --- 4. WELCOME & SCROLL TO EXPLORE PARALLAX EFFECT ---
// ------------------------------------------------------------

// Target the main WELCOME text container (flickering-text-container)
const welcomeText = document.querySelector(".flickering-text-container");
// Target the "scroll to explore" element
// Note: scrollCue is already defined above, but we redefine it here for clarity within this block.
// const scrollCue = document.getElementById("scroll-to-explore"); 

// 1. Parallax for the main WELCOME text (moves up fast, out of view)
gsap.to(welcomeText, {
    yPercent: -150, // Move up 150% of its own height
    ease: "none",
    scrollTrigger: {
        trigger: "#home-section",
        start: "top top",
        end: "bottom top", // Ends when the bottom of the section hits the top of the viewport
        scrub: 1, // Smoother scrub (1 second delay)
    }
});

// 2. Parallax for the "scroll to explore" cue (moves up faster)
gsap.to(scrollCue, {
    yPercent: -500, // Move up 500% relative to its position
    ease: "none",
    scrollTrigger: {
        trigger: "#home-section",
        start: "top top",
        end: "bottom top",
        scrub: 1,
    }
});