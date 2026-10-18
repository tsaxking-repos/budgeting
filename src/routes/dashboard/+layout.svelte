<!--
@component
Dashboard layout for `/dashboard` routes. Acts as middleware for dashboard pages.

Wraps all dashboard views with shared navigation and styling expectations. This
layout isolates dashboard-specific UI from the public site layout.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Navbar } from '$lib/nav/index.svelte';

	const { children } = $props();

	const section: Parameters<typeof Navbar.addSection>[0] = {
		name: 'Finance',
		priority: 1,
		links: [
			{
				name: 'Dashboard',
				href: '/dashboard',
				icon: {
					type: 'material-icons' as const,
					name: 'dashboard'
				}
			},
			{
				name: 'Accounts',
				href: '/dashboard/accounts',
				icon: {
					type: 'material-icons' as const,
					name: 'account_balance_wallet'
				}
			},
			{
				name: 'Transactions',
				href: '/dashboard/transactions',
				icon: {
					type: 'material-icons' as const,
					name: 'receipt_long'
				}
			},
			{
				name: 'Categories',
				href: '/dashboard/categories',
				icon: {
					type: 'material-icons' as const,
					name: 'category'
				}
			},
			{
				name: 'Tags',
				href: '/dashboard/tags',
				icon: {
					type: 'material-icons' as const,
					name: 'sell'
				}
			}
		]
	};

	onMount(() => {
		Navbar.addSection(section);
		return () => Navbar.removeSection(section);
	});
</script>

<main class="dashboard">
	{@render children()}
</main>
