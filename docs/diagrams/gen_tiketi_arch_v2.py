from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import ECR, EKS
from diagrams.aws.database import ElasticacheForRedis, RDS, RDSPostgresqlInstance
from diagrams.aws.management import AmazonManagedGrafana, AmazonManagedPrometheus, Cloudwatch
from diagrams.aws.network import ALB, CloudFront, Endpoint, NATGateway, Route53
from diagrams.aws.security import ACM, IAMRole, KMS, SecretsManager, ShieldAdvanced, WAF
from diagrams.aws.storage import Backup, S3
from diagrams.onprem.client import User


def main() -> None:
    # NOTE: Diagrams uses Graphviz (dot). Ensure it's installed and on PATH.
    with Diagram(
        "Tiketi - Advanced Outer Architecture (v2)",
        graph_attr={
            "pad": "0.4",
            "splines": "spline",
            "nodesep": "0.55",
            "ranksep": "0.7",
            "bgcolor": "white",
        },
        node_attr={"fontsize": "11"},
        edge_attr={"fontsize": "10", "color": "#5b5b5b"},
        filename="docs/diagrams/tiketi-advanced-outer-arch-v2",
        outformat="png",
        show=False,
        direction="TB",
    ):
        user = User("Users")

        # -----------------------------
        # Edge / Global layer
        # -----------------------------
        dns = Route53("Route 53")

        with Cluster("Edge (Global / us-east-1)"):
            cdn = CloudFront("CloudFront")
            waf = WAF("WAF")
            shield = ShieldAdvanced("Shield Adv")
            acm = ACM("ACM (us-east-1)")

            # keep these visually close to CloudFront
            [waf, shield, acm] >> Edge(style="dashed", color="#8a8a8a") >> cdn

        with Cluster("Origins"):
            s3 = S3("S3\nStatic Web")
            alb_origin = ALB("ALB\nAPI Origin")

        # User traffic
        user >> Edge(color="#2d7ff9", penwidth="1.6") >> dns >> Edge(color="#2d7ff9", penwidth="1.6") >> cdn

        # 2-origin split (much clearer than routing everything through one line)
        cdn >> Edge(label="default /*", color="#2d7ff9", penwidth="1.6") >> s3
        cdn >> Edge(label="/api/*", color="#2d7ff9", penwidth="1.6") >> alb_origin

        # -----------------------------
        # Regional layer (ap-northeast-2)
        # -----------------------------
        with Cluster("Seoul (ap-northeast-2) VPC 10.0.0.0/16"):
            with Cluster("Public subnets (A/B)"):
                alb = ALB("ALB\n(ingress)")
                nat = NATGateway("NAT GW")

            with Cluster("Private subnets (A/B)"):
                eks = EKS("EKS\nWorkloads")

                with Cluster("App dependencies"):
                    rds_proxy = RDS("RDS Proxy")
                    rds = RDSPostgresqlInstance("RDS Postgres\nMulti-AZ")
                    redis = ElasticacheForRedis("ElastiCache\nRedis (HA)")
                    backup = Backup("AWS Backup")

                with Cluster("Platform services"):
                    vpce = Endpoint("VPC Endpoints\n(S3/ECR/Logs/Secrets)")
                    ecr = ECR("ECR")
                    sm = SecretsManager("Secrets Manager")
                    kms = KMS("KMS")
                    cw = Cloudwatch("CloudWatch")
                    amp = AmazonManagedPrometheus("AMP")
                    amg = AmazonManagedGrafana("AMG")
                    irsa = IAMRole("IRSA")

            # Wire the origin ALB to the actual ingress ALB inside VPC
            alb_origin >> Edge(style="dashed", color="#8a8a8a") >> alb

            # Ingress path
            alb >> Edge(label="HTTPS", color="#2d7ff9", penwidth="1.6") >> eks

            # Data path
            eks >> Edge(color="#3b82f6") >> rds_proxy >> rds >> Edge(color="#3b82f6") >> backup
            eks >> Edge(color="#3b82f6") >> redis

            # Observability
            eks >> Edge(label="metrics", color="#f59e0b") >> amp >> Edge(color="#f59e0b") >> amg
            eks >> Edge(label="logs/traces", color="#f59e0b") >> cw

            # Private AWS API access
            eks >> Edge(label="private", style="dashed", color="#10b981") >> vpce
            vpce >> Edge(style="dashed", color="#10b981") >> [ecr, sm, cw]
            sm >> Edge(style="dashed", color="#10b981") >> kms

            # Workload identities / image pulls
            eks >> Edge(label="pod IAM", style="dashed", color="#10b981") >> irsa

            # Egress (only when truly needed)
            eks >> Edge(label="egress", style="dotted", color="#9ca3af") >> nat


if __name__ == "__main__":
    main()
