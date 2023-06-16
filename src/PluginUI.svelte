<script>
	import Tabbar from "./components/Tabbar.svelte";
	import Configuration from "./pages/Configuration.svelte";
	import Lint from "./pages/Lint.svelte";
	import Prelint from "./pages/Prelint.svelte";

	import { activeTab, ranPage, ranSelection } from "./store";

	// set the active tab
	let active;
	activeTab.subscribe((value) => {
		console.log(active);
		active = value;
	});

	let page;
	ranPage.subscribe((value) => {
		console.log(active);
		page = value;
	});
	let selection;
	ranSelection.subscribe((value) => {
		console.log(active);
		selection = value;
	});

	function createShapes() {
		parent.postMessage(
			{
				pluginMessage: {
					type: "create-shapes",
					count: count,
					shape: selectedShape.value,
				},
			},
			"*"
		);
	}
</script>

<div class="container">
	<Tabbar />
	{#if active == "page"}
		{#if page}
			<Lint type={"page"} />
		{:else}
			<Prelint type={"page"} />
		{/if}
	{:else if active == "selection"}
		{#if selection}
			<Lint type={"selection"} />
		{:else}
			<Prelint type={"selection"}/>
		{/if}
	{:else if active == "config"}
		<Configuration />
	{/if}
</div>

<style global>
	@import url("https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&display=swap");

	/* Body Structures */
	:global(body) {
		font: 12px "Libre Franklin", "cursive";
		font-family: "Libre Franklin", "cursive";
		text-align: center;
		margin: 0;
		background-color: white;
	}

	/* Text */
	:global(.text-sm-reg) {
		font: 12px "Libre Franklin";
		font-weight: 400;
	}

	:global(.text-sm-med) {
		font: 12px "Libre Franklin";
		font-weight: 500;
	}

	:global(.text-md-reg) {
		font: 14px "Libre Franklin";
		font-weight: 400;
	}

	:global(.text-md-med) {
		font: 14px "Libre Franklin";
		font-weight: 500;
	}

	:global(.text-lg-reg) {
		font: 16px "Libre Franklin";
		font-weight: 400;
	}

	:global(.text-lg-med) {
		font: 16px "Libre Franklin";
		font-weight: 500;
	}

	:global(.text-lg-semibold) {
		font: 16px "Libre Franklin";
		font-weight: 600;
	}

	:global(.text-xl-med) {
		font: 18px "Libre Franklin";
		font-weight: 500;
	}
	/* Add additional global or scoped styles here */
	.container {
		display: flex;
		flex-direction: column;
		height:100%;
	}
</style>
