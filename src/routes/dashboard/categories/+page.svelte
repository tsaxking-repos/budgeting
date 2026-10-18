<script lang="ts">
	import Card from '$lib/components/bootstrap/Card.svelte';
	import { confirm, notify } from '$lib/utils/prompts.svelte';

	const { data } = $props();
	const categoryStruct = $derived(data.finance.structs.category);
	const categories = $derived(data.finance.queries.categories.reactive);

	let name = $state('');
	let kind = $state('expense');
	let parentId = $state('');
	let color = $state('#6c757d');

	let editId = $state<string | null>(null);
	let editName = $state('');
	let editKind = $state('expense');
	let editParentId = $state('');
	let editColor = $state('#6c757d');

	const roots = $derived(categories.filter((cat) => !cat.raw.parent_id));
	const children = (id: string | undefined) =>
		id ? categories.filter((cat) => cat.raw.parent_id === id) : [];

	const createCategory = async () => {
		const payload = {
			name: name.trim(),
			kind,
			color,
			parent_id: parentId || null,
			icon: null
		};
		if (!payload.name) {
			notify({
				title: 'Validation',
				message: 'Category name is required',
				color: 'warning',
				autoHide: 2500
			});
			return;
		}
		const result = await categoryStruct.new(payload);
		if (result.isErr()) {
			notify({
				title: 'Create failed',
				message: result.error.message,
				color: 'danger',
				autoHide: 4500
			});
			return;
		}
		name = '';
		parentId = '';
		notify({
			title: 'Category created',
			message: payload.name,
			color: 'success',
			autoHide: 2000
		});
	};

	const startEdit = (id: string | undefined) => {
		if (!id) return;
		const row = categories.find((cat) => cat.id === id);
		if (!row) return;
		editId = id;
		editName = row.raw.name;
		editKind = row.raw.kind;
		editParentId = row.raw.parent_id ?? '';
		editColor = row.raw.color ?? '#6c757d';
	};

	const saveEdit = async () => {
		if (!editId) return;
		const row = categories.find((cat) => cat.id === editId);
		if (!row) return;
		const res = await row.update({
			name: editName.trim(),
			kind: editKind,
			parent_id: editParentId || null,
			color: editColor
		});
		if (res.isErr()) {
			notify({
				title: 'Save failed',
				message: res.error.message,
				color: 'danger',
				autoHide: 4500
			});
			return;
		}
		editId = null;
		notify({
			title: 'Saved',
			message: 'Category updated',
			color: 'success',
			autoHide: 2000
		});
	};

	const archiveCategory = async (id: string | undefined, categoryName: string | undefined) => {
		if (!id) return;
		const ok = await confirm(`Archive category "${categoryName}"?`);
		if (!ok) return;
		const row = categories.find((cat) => cat.id === id);
		if (!row) return;
		const result = await row.update({ archived: true } as never);
		if (result.isErr()) {
			notify({
				title: 'Archive failed',
				message: result.error.message,
				color: 'danger',
				autoHide: 4500
			});
			return;
		}
		notify({
			title: 'Archived',
			message: categoryName ?? 'Category',
			color: 'success',
			autoHide: 2000
		});
	};
</script>

<div class="container-fluid py-3">
	<div class="row g-3">
		<div class="col-12 col-lg-4">
			<Card title="Create category">
				{#snippet body()}
					<div class="vstack gap-2">
						<input class="form-control" placeholder="Name" bind:value={name} />
						<select class="form-select" bind:value={kind}>
							<option value="expense">Expense</option>
							<option value="income">Income</option>
						</select>
						<select class="form-select" bind:value={parentId}>
							<option value="">No parent</option>
							{#each categories as category (category.id)}
								<option value={category.id}>{category.raw.name}</option>
							{/each}
						</select>
						<input class="form-control form-control-color" type="color" bind:value={color} />
						<button class="btn btn-primary" type="button" onclick={createCategory}>Create</button>
					</div>
				{/snippet}
			</Card>
		</div>

		<div class="col-12 col-lg-8">
			<Card title="Category hierarchy">
				{#snippet body()}
					{#if !categories.length}
						<div class="alert alert-secondary mb-0">No categories found.</div>
					{:else}
						<div class="list-group">
							{#each roots as root (root.id)}
								<div class="list-group-item">
									<div class="d-flex justify-content-between align-items-center gap-2">
										<div>
											<div class="fw-semibold">{root.raw.name}</div>
											<small class="text-muted">{root.raw.kind}</small>
										</div>
										<div class="btn-group btn-group-sm">
											<button
												class="btn btn-outline-secondary"
												type="button"
												onclick={() => startEdit(root.id)}
											>
												Edit
											</button>
											<button
												class="btn btn-outline-danger"
												type="button"
												onclick={() => archiveCategory(root.id, root.raw.name)}
											>
												Archive
											</button>
										</div>
									</div>

									{#if children(root.id).length}
										<div class="list-group mt-2">
											{#each children(root.id) as child (child.id)}
												<div
													class="list-group-item py-2 d-flex justify-content-between align-items-center"
												>
													<div>
														<div>{child.raw.name}</div>
														<small class="text-muted">{child.raw.kind}</small>
													</div>
													<div class="btn-group btn-group-sm">
														<button
															class="btn btn-outline-secondary"
															type="button"
															onclick={() => startEdit(child.id)}
														>
															Edit
														</button>
														<button
															class="btn btn-outline-danger"
															type="button"
															onclick={() => archiveCategory(child.id, child.raw.name)}
														>
															Archive
														</button>
													</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				{/snippet}
			</Card>
		</div>
	</div>

	{#if editId}
		<div class="card mt-3">
			<div class="card-header"><h5 class="mb-0">Edit category</h5></div>
			<div class="card-body">
				<div class="row g-2">
					<div class="col-12 col-md-3">
						<input class="form-control" bind:value={editName} />
					</div>
					<div class="col-12 col-md-3">
						<select class="form-select" bind:value={editKind}>
							<option value="expense">Expense</option>
							<option value="income">Income</option>
						</select>
					</div>
					<div class="col-12 col-md-3">
						<select class="form-select" bind:value={editParentId}>
							<option value="">No parent</option>
							{#each categories.filter((cat) => cat.id !== editId) as cat (cat.id)}
								<option value={cat.id}>{cat.raw.name}</option>
							{/each}
						</select>
					</div>
					<div class="col-12 col-md-1">
						<input class="form-control form-control-color" type="color" bind:value={editColor} />
					</div>
					<div class="col-12 col-md-2 d-grid gap-2 d-md-flex">
						<button class="btn btn-success" type="button" onclick={saveEdit}>Save</button>
						<button class="btn btn-outline-secondary" type="button" onclick={() => (editId = null)}>
							Cancel
						</button>
					</div>
				</div>
				<div class="form-text mt-2">
					Categories can now be assigned directly from the transactions page, individually or in
					bulk.
				</div>
			</div>
		</div>
	{/if}
</div>
