<script>
    export let onClick;
    export let type;
</script>

<button
    class={`${
        type == "primary"
            ? "text-md-med primary"
            : type == "tertiary"
            ? "text-md-med tertiary"
            : type == "link"
            ? "text-sm-med link"
            : ""
    }`}
    on:click={onClick}
>
    <slot />
</button>

<style>
    .primary {
        border-radius: 8px;
        border: none;
        padding: 12px 16px;
        background-color: #004c45;
        color: white;
        flex-grow: 1;
    }

    .primary:hover {
        background-color: #172d2d;
        animation-name: on-hover-button;
        animation-duration: 100ms;
        cursor: pointer;
    }

    @keyframes on-hover-button {
        0% {
            background-color: #004c45;
        }
        100% {
            background-color: #172d2d;
        }
    }

    .tertiary {
        border-radius: 8px;
        padding: 12px 16px;
        border: none;
        color: #172d2d;
        background-color: white;
        cursor: pointer;
    }

    .tertiary:hover {
        background-color: #e5f0e8;
        cursor: pointer;
    }

    .link {
        border: none;
        background: none;
        color: #128ba6;
        cursor: pointer;
    }

    .link:hover {
        text-decoration: underline;
        cursor: pointer;
        color: #0e687d;
    }
</style>
