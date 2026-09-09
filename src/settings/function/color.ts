export const getTextFaintHex = () : string => {
    const probe = document.body.createSpan();
    probe.setCssStyles({ color: "var(--text-faint)" });
    const resolvedColor = getComputedStyle(probe).color;
    probe.remove();

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
        return "#666666";
    }
    context.fillStyle = resolvedColor;
    return context.fillStyle;
};
