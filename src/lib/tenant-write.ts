type UpdateMany = (args: { where: { id: string; companyId: string }; data: object }) => Promise<{ count: number }>;
type DeleteMany = (args: { where: { id: string; companyId: string } }) => Promise<{ count: number }>;

export async function updateOwned(model: object, id: string, companyId: string, data: object) {
  const writer = model as { updateMany: UpdateMany };
  return (await writer.updateMany({ where: { id, companyId }, data })).count;
}

export async function deleteOwned(model: object, id: string, companyId: string) {
  const writer = model as { deleteMany: DeleteMany };
  return (await writer.deleteMany({ where: { id, companyId } })).count;
}
