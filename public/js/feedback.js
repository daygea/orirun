function renderFeedbackSection(contextType = "general", contextData = {}, target = document.body) {
    const existing = document.querySelector(".feedback-section.active");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.className = "feedback-section active";
    container.style.marginTop = "20px";
    container.style.textAlign = "center";
    container.style.opacity = 1;

    container.innerHTML = `
        <div class="feedback-prompt opacity-shield"
             style="background:#f9f9f9;border-radius:10px;padding:12px;display:inline-block;">
            
            <p style="margin-bottom:8px;font-size:0.9rem;color:#333;">
                <span data-translate="feedback_prompt">Was this reading helpful to you?</span>
            </p>

            <div class="feedback-buttons" style="display:flex;justify-content:center;gap:10px;">
                <button class="feedback-btn" data-feedback="yes"
                    style="cursor:pointer;font-size:1.2rem;">👍</button>
                <button class="feedback-btn" data-feedback="no"
                    style="cursor:pointer;font-size:1.2rem;">👎</button>
            </div>

            <p class="feedback-response" 
               style="display:none;margin-top:8px;color:green;font-size:0.85rem;">
                <span data-translate="thanks_feedback">Thank you for your feedback!</span>
            </p>

        </div>
    `;

    target.appendChild(container);

    const buttons = container.querySelectorAll(".feedback-btn");
    const responseMsg = container.querySelector(".feedback-response");

    const updateOpacity = async () => {
        try {
            const fbRes = await fetch(
                `/api/feedback/get?odu=${encodeURIComponent(contextData.oduName)}&orientation=${encodeURIComponent(contextData.orientationText)}&spec=${encodeURIComponent(contextData.specificOrientation)}&solution=${encodeURIComponent(contextData.solution)}&detail=${encodeURIComponent(contextData.solutionDetails)}`
            );

            if (!fbRes.ok) throw new Error("Failed to fetch feedback");

            const feedback = await fbRes.json();
            const positive = feedback?.positive || 0;
            const negative = feedback?.negative || 0;

            let visibilityScore = 1;

            if (negative > 0) {
                const ratio = positive / Math.max(negative, 1);

                if (ratio < 0.2) visibilityScore = 0.15;
                else if (ratio < 0.3) visibilityScore = 0.4;
                else if (ratio < 0.5) visibilityScore = 0.7;
            }

            // Fade ONLY the main divination result
            const resultElement = document.getElementById("divinationResult");
            if (resultElement) resultElement.style.opacity = visibilityScore;

            // Force feedback section to always be 100% visible
            container.querySelectorAll(".opacity-shield").forEach(el => {
                el.style.opacity = "1 !important";
            });

            // --- Warning message logic ---
            const warningContainer = document.getElementById("divinationWarning");

            // Ensure container is flex-centered
            warningContainer.style.display = "flex";
            warningContainer.style.justifyContent = "center";
            warningContainer.style.alignItems = "center";
            warningContainer.style.flexDirection = "column";
            warningContainer.style.width = "100%";

            // Ensure warnDiv exists once
            let warnDiv = document.getElementById("lowTrustWarning");
            if (!warnDiv) {
                warnDiv = document.createElement("div");
                warnDiv.id = "lowTrustWarning";
                warnDiv.className = "alert alert-warning";

                warnDiv.style.textAlign = "center";
                warnDiv.style.padding = "10px 20px";
                warnDiv.style.fontWeight = "bold";
                warnDiv.style.border = "1px solid #f0ad4e";
                warnDiv.style.borderRadius = "8px";
                warnDiv.style.backgroundColor = "#fff3cd";
                warnDiv.style.maxWidth = "600px";
                warnDiv.style.margin = "10px auto";   // center horizontally
                warnDiv.style.display = "none";        // default hidden
                warnDiv.innerHTML = `<span data-translate>This divination message has received low trust from users.</span>`;
                warningContainer.appendChild(warnDiv);
            }

            // Show/hide logic
            warnDiv.style.display = "none";
            warnDiv.style.opacity = "1";

            if (contextData.hasAccess) {
                if (visibilityScore < 0.2) {
                    warnDiv.style.display = "block";  // centered now
                }
            } else {
                warnDiv.style.display = "none";
            }


        } catch (err) {
            console.warn("Opacity update failed:", err);
        }
    };

    // Run initially
    updateOpacity();

    // Handle button clicks
    buttons.forEach(btn => {
        btn.addEventListener("click", async () => {
            const feedbackValue = btn.dataset.feedback;
            container.querySelector(".feedback-buttons").style.display = "none";
            responseMsg.style.display = "block";

            try {
                await fetch(`${SERVER_URL}/api/feedback`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        feedback: feedbackValue,
                        contextType,
                        contextData,
                        timestamp: new Date().toISOString()
                    })
                });

                updateOpacity();
            } catch (error) {
                console.error("Feedback submission failed:", error);
            }
        });
    });
}

