<script>
    import Error from "./Error.svelte";

    export let list;
    export let type;
</script>

<div class="container">
    {#each list as item}
        <Error
            obj={item}    
            type={type}
        />
    {/each}
</div>

<style>
    .container {
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: stretch;
        overflow-y: scroll;
        height: 80vh;
    }
</style>
