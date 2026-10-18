<script lang="ts">
	import { resolve } from '$app/paths';
	import Card from '$lib/components/bootstrap/Card.svelte';
	import { confirm, notify } from '$lib/utils/prompts.svelte';
	import { centsToCurrency } from '$lib/services/finance/utils';

	const { data } = $props();
	const bucketStruct = $derived(data.finance.structs.bucket);
	const bucketQuery = $derived(data.finance.queries.buckets);
	const buckets = $derived(bucketQuery.reactive);

	let name = $state('');
	let creating = $state(false);

	let editId = $state<string | null>(null);
	let editName = $state('');

	const startEdit = (id: string | undefined, currentName: string | undefined) => {
		if (!id) return;
		editId = id;
		editName = currentName ?? '';
	};

	const cancelEdit = () => {
		editId = null;
		editName = '';
	};

	const createAccount = async () => {
		if (creating) return;
		if (!name.trim()) {
			notify({
				title: 'Validation',
				message: 'Account name is required',
				color: 'warning',
				autoHide: 3000
			});
			return;
		}
		creating = true;
		const result = await bucketStruct.new({
			name: name.trim(),
			balance: 0
		});
		creating = false;
		if (result.isErr()) {
			notify({
				title: 'Failed',
				message: result.error.message,
				color: 'danger',
				autoHide: 5000
			});
			return;
		}
		name = '';
		notify({
			title: 'Success',
			message: 'Account created',
			color: 'success',
			autoHide: 2500
		});
	};

	const saveEdit = async () => {
		if (!editId) return;
		const row = buckets.find((bucket) => bucket.id === editId);
		if (!row) return;
		const result = await row.update({
			name: editName.trim()
		});
		if (result.isErr()) {
			notify({
				title: 'Failed',
				message: result.error.message,
				color: 'danger',
				autoHide: 4500
			});
			return;
		}
		cancelEdit();
		notify({
			title: 'Saved',
			message: 'Account updated',
			color: 'success',
			autoHide: 2500
		});
	};

	const archiveAccount = async (id: string | undefined, accountName: string | undefined) => {
		if (!id) return;
		const ok = await confirm(`Archive account "${accountName}"?`);
		if (!ok) return;
		const row = buckets.find((bucket) => bucket.id === id);
		if (!row) return;
		const result = await row.update({ archived: true } as never);
		if (result.isErr()) {
			notify({
				title: 'Archive failed',
				message: result.error.message,
				color: 'danger',
				autoHide: 5000
			});
			return;
		}
		notify({
			title: 'Archived',
			message: `"${accountName}" archived`,
			color: 'success',
			autoHide: 2500
		});
	};
</script>

<div class="container-fluid py-3">
	<div class="row g-3">
		<div class="col-12 col-lg-4">
			<Card title="Create account">
				{#snippet body()}
					<div class="vstack gap-2">
						<label class="form-label mb-0" for="account-name">Name</label>
						<input
							id="account-name"
							class="form-control"
							type="text"
							bind:value={name}
							placeholder="Checking"
						/>
						<button
							class="btn btn-primary"
							type="button"
							disabled={creating}
							onclick={createAccount}
						>
							{creating ? 'Creating...' : 'Create account'}
						</button>
						<small class="text-muted">
							Balance is maintained by database transaction triggers.
						</small>
					</div>
				{/snippet}
			</Card>
		</div>

		<div class="col-12 col-lg-8">
			<Card title="Accounts">
				{#snippet body()}
					{#if !buckets.length}
						<div class="alert alert-secondary mb-0">No accounts yet.</div>
					{:else}
						<div class="table-responsive">
							<table class="table table-sm align-middle mb-0">
								<thead>
									<tr>
										<th>Name</th>
										<th class="text-end">Balance</th>
										<th class="text-end">Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each buckets as bucket (bucket.id)}
										<tr>
											<td>
												{#if editId === bucket.id}
													<input class="form-control form-control-sm" bind:value={editName} />
												{:else}
													{bucket.raw.name}
												{/if}
											</td>
											<td class="text-end">{centsToCurrency(bucket.raw.balance)}</td>
											<td class="text-end">
												{#if editId === bucket.id}
													<div class="btn-group btn-group-sm">
														<button class="btn btn-success" type="button" onclick={saveEdit}
															>Save</button
														>
														<button
															class="btn btn-outline-secondary"
															type="button"
															onclick={cancelEdit}
														>
															Cancel
														</button>
													</div>
												{:else}
													<div class="btn-group btn-group-sm">
														<a
															class="btn btn-outline-primary"
															href={resolve('/dashboard/accounts/[id]', { id: bucket.id ?? '' })}
														>
															View
														</a>
														<button
															class="btn btn-outline-secondary"
															type="button"
															onclick={() => startEdit(bucket.id, bucket.raw.name)}
														>
															Edit
														</button>
														<button
															class="btn btn-outline-danger"
															type="button"
															onclick={() => archiveAccount(bucket.id, bucket.raw.name)}
														>
															Archive
														</button>
													</div>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/snippet}
			</Card>
		</div>
	</div>
</div>
