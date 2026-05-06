interface PageHeaderProps {
  totalCount: number;
}

export default function PageHeader(_props: PageHeaderProps) {
  return (
    <div class="page-header">
      <h1 class="display">Projects</h1>
    </div>
  );
}
