#!/usr/bin/env python3
"""Generate 6-view Tiketi architecture diagrams (drawio).

SSoT is the user's original outer architecture drawio export.
We reuse the *exact* mxgraph.aws4 styles from that file so the output stays
consistent with the hand-drawn look.

Outputs (drawio):
- 01-infra-outer-terraform.drawio
- 02-platform-inner-k8s.drawio
- 03-runtime-traffic-flow.drawio
- 04-cicd-gitops.drawio
- 05-observability-signals.drawio
- 06-security-identity-zerotrust.drawio
"""

from __future__ import annotations

import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Iterable, Optional


SSOT_PATH = "/Users/cielo/Downloads/Tiketi_Advanced_Outer_Architecture.drawio (1).xml"
OUT_DIR = "/Users/cielo/devops/tiketi/docs/diagrams/architecture-views"


# ---------- minimal drawio writer ----------


@dataclass
class Styles:
    group: dict[str, str]
    by_value: dict[str, str]
    edge_base: str
    text: str
    dashed_box: str


class Doc:
    def __init__(self, title: str, model_attrs: dict[str, str]):
        self.mxfile = ET.Element("mxfile", {"host": "app.diagrams.net"})
        self.diagram = ET.SubElement(
            self.mxfile,
            "diagram",
            {"name": title, "id": slug_id(title)},
        )
        self.model = ET.SubElement(self.diagram, "mxGraphModel", model_attrs)
        self.root = ET.SubElement(self.model, "root")
        ET.SubElement(self.root, "mxCell", {"id": "0"})
        ET.SubElement(self.root, "mxCell", {"id": "1", "parent": "0"})
        self._id = 1

    def nid(self, prefix: str) -> str:
        self._id += 1
        return f"{prefix}-{self._id}"

    def add_vertex(
        self,
        *,
        value: str,
        style: str,
        x: float,
        y: float,
        w: float,
        h: float,
        parent: str = "1",
        cell_id: Optional[str] = None,
    ) -> str:
        cid = cell_id or self.nid("v")
        c = ET.SubElement(
            self.root,
            "mxCell",
            {"id": cid, "value": value, "style": style, "vertex": "1", "parent": parent},
        )
        ET.SubElement(
            c,
            "mxGeometry",
            {"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"},
        )
        return cid

    def add_edge(
        self,
        *,
        source: str,
        target: str,
        style: str,
        value: str = "",
        points: Optional[list[tuple[float, float]]] = None,
        parent: str = "1",
        cell_id: Optional[str] = None,
    ) -> str:
        cid = cell_id or self.nid("e")
        c = ET.SubElement(
            self.root,
            "mxCell",
            {"id": cid, "value": value, "style": style, "edge": "1", "parent": parent, "source": source, "target": target},
        )
        g = ET.SubElement(c, "mxGeometry", {"relative": "1", "as": "geometry"})
        if points:
            arr = ET.SubElement(g, "Array", {"as": "points"})
            for x, y in points:
                ET.SubElement(arr, "mxPoint", {"x": str(x), "y": str(y)})
        return cid

    def write(self, path: str) -> None:
        tree = ET.ElementTree(self.mxfile)
        tree.write(path, encoding="utf-8", xml_declaration=False)


def slug_id(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.strip()).strip("-")
    return s.lower()[:60] or "diagram"


# ---------- style extraction from SSoT ----------


def extract_styles() -> tuple[dict[str, str], dict[str, str], str]:
    root = ET.parse(SSOT_PATH).getroot()
    mxroot = root.find(".//mxGraphModel/root")
    assert mxroot is not None

    group_styles: dict[str, str] = {}
    by_value: dict[str, str] = {}
    edge_base = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"

    for c in mxroot.findall("mxCell"):
        style = c.get("style") or ""
        val = (c.get("value") or "").strip()

        # group outlines
        if "shape=mxgraph.aws4.group" in style and "grIcon=" in style:
            m = re.search(r"grIcon=mxgraph\.aws4\.([^;]+);", style)
            if m:
                group_styles.setdefault(m.group(1), style)

        # pick a representative edge style
        if c.get("edge") == "1" and "edgeStyle=orthogonalEdgeStyle" in style:
            edge_base = style

        # map by specific visible labels
        if val in {
            "Route53",
            "Cloud Front",
            "S3",
            "WAF",
            "ACM",
            "Cloud Watch",
            "Secret Manager",
            "Nat Gateway",
            "Internet Gateway",
            "Route Table",
            "ElastiCache",
            "RDS",
            "EKS",
            "ALB Capacity",
            "ALB Security Group",
        }:
            by_value.setdefault(val, style)

        # capture user / internet icons (they have empty value)
        if val == "" and "shape=mxgraph.aws4.users" in style:
            by_value.setdefault("Users", style)
        if val == "" and "shape=mxgraph.aws4.internet_alt2" in style:
            by_value.setdefault("Internet", style)

    return group_styles, by_value, edge_base


def build_common_styles(group_styles: dict[str, str], by_value: dict[str, str], edge_base: str) -> Styles:
    # text style: keep simple drawio text
    text = "text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=12;"

    dashed_box = "rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#666666;dashed=1;"

    return Styles(group=group_styles, by_value=by_value, edge_base=edge_base, text=text, dashed_box=dashed_box)


def edge_style(base: str, *, dashed: bool = False, color: Optional[str] = None, end_arrow: Optional[str] = None) -> str:
    s = base
    if dashed and "dashed=1" not in s:
        s += ";dashed=1"
    if color:
        # overwrite or append
        if "strokeColor=" in s:
            s = re.sub(r"strokeColor=[^;]+", f"strokeColor={color}", s)
        else:
            s += f";strokeColor={color}"
    if end_arrow:
        if "endArrow=" in s:
            s = re.sub(r"endArrow=[^;]+", f"endArrow={end_arrow}", s)
        else:
            s += f";endArrow={end_arrow};endFill=1"
    return s


def model_attrs_template() -> dict[str, str]:
    # keep large canvas so routing is easy
    return {
        "dx": "2000",
        "dy": "1200",
        "grid": "1",
        "gridSize": "10",
        "guides": "1",
        "tooltips": "1",
        "connect": "1",
        "arrows": "1",
        "fold": "1",
        "page": "1",
        "pageScale": "1",
        "pageWidth": "2000",
        "pageHeight": "1200",
        "math": "0",
        "shadow": "0",
    }


# ---------- views ----------


def add_title(doc: Doc, styles: Styles, title: str) -> None:
    doc.add_vertex(value=title, style=styles.text.replace("align=center", "align=center") + ";fontSize=24;fontStyle=1", x=600, y=20, w=800, h=40)


def add_legend(doc: Doc, styles: Styles, x: float, y: float, w: float, h: float, lines: list[str]) -> None:
    box = doc.add_vertex(value="", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;dashed=1;", x=x, y=y, w=w, h=h)
    doc.add_vertex(value="Legend", style=styles.text + ";fontSize=14;fontStyle=1", x=x, y=y + 6, w=w, h=24)
    text = "<div style='text-align:left;font-size:11px;line-height:1.3'>" + "<br>".join(lines) + "</div>"
    doc.add_vertex(value=text, style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=top;whiteSpace=wrap;rounded=0;fontSize=11;", x=x + 10, y=y + 34, w=w - 20, h=h - 44)


def view_infra_outer(styles: Styles, docs: dict[str, list[str]]) -> Doc:
    doc = Doc("01) Infra Outer (Terraform Scope)", model_attrs_template())
    add_title(doc, styles, "Tiketi - Infra Outer (Terraform Scope)")

    # backgrounds (regions)
    doc.add_vertex(value="AWS Cloud", style=styles.group["group_aws_cloud_alt"], x=30, y=70, w=1940, h=1100)
    doc.add_vertex(value="us-east-1 (Global for CloudFront/WAF)", style=styles.group["group_region"], x=60, y=120, w=920, h=420)
    doc.add_vertex(value="ap-northeast-2 (Seoul)", style=styles.group["group_region"], x=60, y=570, w=1910, h=580)

    # ------------------------------------------------------------------
    # Terragrunt stacks (declare what is actually applied)
    # ------------------------------------------------------------------
    stack_style = "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8fafc;strokeColor=#111827;dashed=0;fontSize=12;"
    stack_style_todo = "rounded=1;whiteSpace=wrap;html=1;fillColor=#fff7ed;strokeColor=#d97706;dashed=1;fontSize=12;"

    # state backend stack (per env/region)
    st_boot = doc.add_vertex(
        value="<b>terragrunt</b><br>live/&lt;env&gt;/ap-northeast-2/00-bootstrap-state<br><font style='font-size:11px'>S3 tfstate + DynamoDB lock</font>",
        style=stack_style,
        x=90,
        y=610,
        w=520,
        h=140,
    )

    # IAM for GitHub OIDC (per env/region)
    st_gh = doc.add_vertex(
        value="<b>terragrunt</b><br>live/&lt;env&gt;/ap-northeast-2/05-iam-github-oidc<br><font style='font-size:11px'>OIDC provider + plan/apply/deploy roles</font>",
        style=stack_style,
        x=640,
        y=610,
        w=560,
        h=140,
    )

    # network / eks / irsa / data stacks
    st_net = doc.add_vertex(
        value="<b>terragrunt</b><br>live/&lt;env&gt;/ap-northeast-2/10-network<br><font style='font-size:11px'>VPC + Public/Private subnets + NAT per AZ</font>",
        style=stack_style,
        x=90,
        y=770,
        w=520,
        h=150,
    )
    st_eks = doc.add_vertex(
        value="<b>terragrunt</b><br>live/&lt;env&gt;/ap-northeast-2/20-eks<br><font style='font-size:11px'>EKS 1.30, private endpoint, nodegroups: app/observability</font>",
        style=stack_style,
        x=640,
        y=770,
        w=560,
        h=150,
    )
    st_irsa = doc.add_vertex(
        value="<b>terragrunt</b><br>live/&lt;env&gt;/ap-northeast-2/21-eks-irsa<br><font style='font-size:11px'>IRSA roles: ALB controller / ExternalDNS / EBS CSI</font>",
        style=stack_style,
        x=1230,
        y=770,
        w=680,
        h=150,
    )
    st_rds = doc.add_vertex(
        value="<b>terragrunt</b><br>live/&lt;env&gt;/ap-northeast-2/30-data-rds<br><font style='font-size:11px'>RDS(Postgres) Multi-AZ + SG from EKS node SG</font>",
        style=stack_style,
        x=640,
        y=940,
        w=560,
        h=160,
    )
    st_redis = doc.add_vertex(
        value="<b>terragrunt</b><br>live/&lt;env&gt;/ap-northeast-2/31-data-redis<br><font style='font-size:11px'>ElastiCache Redis(Multi-AZ) + SG from EKS node SG</font>",
        style=stack_style,
        x=90,
        y=940,
        w=520,
        h=160,
    )

    # global edge stack (CloudFront/WAF/OAC/S3/Route53/ACM)
    st_edge = doc.add_vertex(
        value="<b>terragrunt</b><br>live/global/40-edge<br><font style='font-size:11px'>module.edge (Route53/S3/OAC/CloudFront/WAF/ACM)</font>",
        style=stack_style,
        x=90,
        y=160,
        w=880,
        h=160,
    )
    doc.add_vertex(
        value="<font style='font-size:11px'>NOTE: CloudFront+WAF are created in us-east-1; ALB cert is regional (ap-northeast-2).</font>",
        style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=11;",
        x=100,
        y=330,
        w=860,
        h=30,
    )

    # optional but recommended (not yet in Terraform modules): VPC Endpoints, RDS Proxy
    st_todo = doc.add_vertex(
        value="<b>TODO (recommended)</b><br>VPC Endpoints (S3 gateway, ECR/Logs/Secrets interface)<br>RDS Proxy",
        style=stack_style_todo,
        x=1230,
        y=610,
        w=680,
        h=140,
    )

    # ------------------------------------------------------------------
    # Key AWS resources (icons) mapped to stacks
    # ------------------------------------------------------------------
    base = styles.edge_base

    # Edge resources (us-east-1 scope items)
    cf = doc.add_vertex(value="CloudFront", style=styles.by_value["Cloud Front"], x=140, y=360, w=78, h=78)
    waf = doc.add_vertex(value="WAFv2<br>(CLOUDFRONT)", style=styles.by_value["WAF"], x=260, y=360, w=78, h=78)
    acm_cf = doc.add_vertex(
        value="ACM<br>(CloudFront cert)",
        style=styles.by_value["WAF"].replace("resIcon=mxgraph.aws4.waf", "resIcon=mxgraph.aws4.acm"),
        x=380,
        y=360,
        w=78,
        h=78,
    )
    doc.add_edge(source=waf, target=cf, style=edge_style(base, dashed=True))
    doc.add_edge(source=acm_cf, target=cf, style=edge_style(base, dashed=True))

    # Edge resources (regional items)
    r53 = doc.add_vertex(value="Route53", style=styles.by_value["Route53"], x=120, y=410, w=78, h=78)
    s3 = doc.add_vertex(value="S3 (frontend)", style=styles.by_value["S3"], x=520, y=360, w=78, h=78)
    acm_alb = doc.add_vertex(
        value="ACM<br>(ALB cert)",
        style=styles.by_value["WAF"].replace("resIcon=mxgraph.aws4.waf", "resIcon=mxgraph.aws4.acm"),
        x=520,
        y=450,
        w=78,
        h=78,
    )
    oac = doc.add_vertex(
        value="OAC<br>(sigv4)",
        style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F3F4F6;strokeColor=#6B7280;fontSize=11;",
        x=640,
        y=380,
        w=120,
        h=50,
    )
    doc.add_edge(source=r53, target=cf, style=edge_style(base))
    doc.add_edge(source=cf, target=s3, style=edge_style(base), value="default /*")
    doc.add_edge(source=cf, target=oac, style=edge_style(base, dashed=True))
    doc.add_edge(source=oac, target=s3, style=edge_style(base, dashed=True), value="bucket policy")

    # Regional network + EKS + data resources
    vpc = doc.add_vertex(value="VPC", style=styles.by_value["Route Table"].replace("shape=mxgraph.aws4.route_table", "shape=mxgraph.aws4.vpc"), x=140, y=1040, w=78, h=78)
    nat = doc.add_vertex(value="NAT GW (per AZ)", style=styles.by_value["Nat Gateway"], x=260, y=1040, w=78, h=78)
    igw = doc.add_vertex(value="IGW", style=styles.by_value["Internet Gateway"], x=380, y=1040, w=78, h=78)
    eks = doc.add_vertex(value="EKS", style=styles.by_value["EKS"], x=760, y=1040, w=78, h=78)
    ng_app = doc.add_vertex(value="NG: app<br>t3.large x2..4", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F2F8;strokeColor=#147EBA;fontSize=11;", x=860, y=1020, w=170, h=70)
    ng_obs = doc.add_vertex(value="NG: observability<br>t3.large x2..4", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FCE7F3;strokeColor=#BC1356;fontSize=11;", x=1040, y=1020, w=200, h=70)

    rds = doc.add_vertex(value="RDS Postgres<br>Multi-AZ", style=styles.by_value["RDS"], x=1320, y=1040, w=78, h=78)
    redis = doc.add_vertex(value="ElastiCache Redis<br>Multi-AZ", style=styles.by_value["ElastiCache"], x=1460, y=1040, w=78, h=78)
    sm = doc.add_vertex(value="Secrets Manager", style=styles.by_value["Secret Manager"], x=1600, y=1040, w=78, h=78)

    # dependency edges between stacks (dashed)
    dep = edge_style(base, dashed=True, color="#6B7280", end_arrow="block")
    doc.add_edge(source=st_net, target=st_eks, style=dep, value="dependency")
    doc.add_edge(source=st_eks, target=st_irsa, style=dep, value="dependency")
    doc.add_edge(source=st_eks, target=st_rds, style=dep, value="node SG")
    doc.add_edge(source=st_eks, target=st_redis, style=dep, value="node SG")
    doc.add_edge(source=st_boot, target=st_net, style=dep, value="remote_state")
    doc.add_edge(source=st_boot, target=st_eks, style=dep, value="remote_state")
    doc.add_edge(source=st_boot, target=st_gh, style=dep, value="remote_state")

    # resources-to-stack association (dotted-like: dashed, no labels)
    assoc = edge_style(base, dashed=True, color="#9CA3AF")
    doc.add_edge(source=st_edge, target=r53, style=assoc)
    doc.add_edge(source=st_edge, target=s3, style=assoc)
    doc.add_edge(source=st_edge, target=cf, style=assoc)
    doc.add_edge(source=st_edge, target=waf, style=assoc)
    doc.add_edge(source=st_edge, target=acm_cf, style=assoc)
    doc.add_edge(source=st_edge, target=acm_alb, style=assoc)
    doc.add_edge(source=st_net, target=vpc, style=assoc)
    doc.add_edge(source=st_net, target=nat, style=assoc)
    doc.add_edge(source=st_net, target=igw, style=assoc)
    doc.add_edge(source=st_eks, target=eks, style=assoc)
    doc.add_edge(source=st_eks, target=ng_app, style=assoc)
    doc.add_edge(source=st_eks, target=ng_obs, style=assoc)
    doc.add_edge(source=st_rds, target=rds, style=assoc)
    doc.add_edge(source=st_redis, target=redis, style=assoc)
    doc.add_edge(source=st_rds, target=sm, style=assoc)

    add_legend(
        doc,
        styles,
        90,
        440,
        880,
        120,
        [
            "Solid: data/control association",
            "Dashed: dependency / recommended(TODO)",
            "Stacks are terragrunt live folders -> Terraform modules",
            "Docs:",
            *[f"- {u}" for u in docs["infra"]],
        ],
    )
    return doc


def view_platform_inner(styles: Styles, docs: dict[str, list[str]]) -> Doc:
    doc = Doc("02) Platform Inner (Kubernetes Object View)", model_attrs_template())
    add_title(doc, styles, "Tiketi - Platform Inner (Kubernetes Object View / EKS)")

    doc.add_vertex(value="EKS Cluster: tiketi-<env> (ap-northeast-2) | endpoint: private-access=true, public=false", style=styles.dashed_box, x=60, y=90, w=1880, h=1050)

    # nodegroup lanes (from terraform/modules/eks node labels: nodegroup=<name>)
    ng_app_lane = doc.add_vertex(value="NodeGroup: app (label: nodegroup=app)", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F2F8;strokeColor=#147EBA;", x=90, y=140, w=900, h=380)
    ng_obs_lane = doc.add_vertex(value="NodeGroup: observability (label: nodegroup=observability)", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FCE7F3;strokeColor=#BC1356;", x=1040, y=140, w=900, h=380)

    # kube-system add-ons (declared via Helm/manifest, IAM roles via terraform/modules/eks-irsa)
    kube_addons = doc.add_vertex(value="Namespace: kube-system", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F3F4F6;strokeColor=#6B7280;", x=90, y=540, w=560, h=580)
    sa_alb = doc.add_vertex(value="ServiceAccount\\naws-load-balancer-controller\\nannotation: eks.amazonaws.com/role-arn = (eks-irsa output)\\naws_load_balancer_controller_role_arn", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#6B7280;fontSize=11;", x=110, y=600, w=520, h=90)
    dep_alb = doc.add_vertex(value="Deployment\\naws-load-balancer-controller", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#6B7280;fontSize=11;", x=110, y=710, w=520, h=70)
    sa_dns = doc.add_vertex(value="ServiceAccount\\nexternal-dns\\nannotation: eks.amazonaws.com/role-arn = (eks-irsa output)\\nexternal_dns_role_arn", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#6B7280;fontSize=11;", x=110, y=800, w=520, h=90)
    dep_dns = doc.add_vertex(value="Deployment\\nexternal-dns", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#6B7280;fontSize=11;", x=110, y=910, w=520, h=70)
    dep_ebs = doc.add_vertex(value="Deployment\\naws-ebs-csi-driver\\nSA: ebs-csi-controller-sa (IRSA)\\noutput: ebs_csi_role_arn", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#6B7280;fontSize=11;", x=110, y=1000, w=520, h=90)

    # app namespace on app nodegroup
    ns_app = doc.add_vertex(value="Namespace: app", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F2F8;strokeColor=#147EBA;", x=110, y=190, w=860, h=310, parent="1")
    ingress = doc.add_vertex(value="Ingress backend\\n(ingressClassName: alb)\\nannotations:\\n- scheme=internet-facing\\n- target-type=ip\\n- certificate-arn=(edge output) alb_certificate_arn\\n- healthcheck-path=/health\\n- external-dns hostname=api.<domain>", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#147EBA;fontSize=11;", x=130, y=240, w=360, h=160)
    svc = doc.add_vertex(value="Service backend (ClusterIP)", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#147EBA;", x=510, y=240, w=180, h=60)
    deploy = doc.add_vertex(value="Deployment backend\\nnodeSelector: nodegroup=app\\nHPA + PDB", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#147EBA;fontSize=11;", x=510, y=320, w=220, h=80)
    pods = doc.add_vertex(value="Pods xN", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#EFF6FF;strokeColor=#147EBA;", x=750, y=320, w=200, h=80)
    cfg = doc.add_vertex(value="ConfigMap", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#147EBA;", x=720, y=240, w=110, h=60)
    sec = doc.add_vertex(value="Secret\\n(source: SecretsManager via ExternalSecret - optional)", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#147EBA;fontSize=10;", x=840, y=240, w=110, h=60)
    sa_app = doc.add_vertex(value="ServiceAccount backend\\n(TODO if app needs AWS API)\\nannotation: eks.amazonaws.com/role-arn", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff7ed;strokeColor=#d97706;dashed=1;fontSize=10;", x=510, y=410, w=440, h=60)

    # observability namespace on observability nodegroup
    ns_obs = doc.add_vertex(value="Namespace: observability", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FCE7F3;strokeColor=#BC1356;", x=1060, y=190, w=860, h=310)
    prom = doc.add_vertex(value="Prometheus (kube-prometheus-stack)\\nnodeSelector: nodegroup=observability", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#BC1356;fontSize=11;", x=1080, y=240, w=360, h=70)
    sm = doc.add_vertex(value="ServiceMonitor backend", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#BC1356;", x=1080, y=330, w=360, h=60)
    graf = doc.add_vertex(value="Grafana", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#BC1356;", x=1460, y=240, w=440, h=70)
    loki = doc.add_vertex(value="Loki", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#BC1356;", x=1460, y=330, w=440, h=60)
    promtail = doc.add_vertex(value="Promtail DaemonSet\\n(nodeSelector: nodegroup=observability)", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#BC1356;fontSize=11;", x=1080, y=410, w=820, h=70)

    # external AWS deps
    alb_ext = doc.add_vertex(value="ALB", style=styles.by_value["ALB Capacity"].replace("ALB Capacity", ""), x=720, y=540, w=78, h=78)
    ecr = doc.add_vertex(value="ECR", style=styles.by_value["S3"].replace("resIcon=mxgraph.aws4.s3", "resIcon=mxgraph.aws4.ecr").replace("fillColor=#7AA116", "fillColor=#D05C17"), x=820, y=540, w=78, h=78)
    rds = doc.add_vertex(value="RDS", style=styles.by_value["RDS"], x=920, y=540, w=78, h=78)
    redis = doc.add_vertex(value="ElastiCache", style=styles.by_value["ElastiCache"], x=1020, y=540, w=78, h=78)
    secrets = doc.add_vertex(value="Secrets Manager", style=styles.by_value["Secret Manager"], x=1120, y=540, w=78, h=78)

    base = styles.edge_base
    doc.add_edge(source=ingress, target=svc, style=edge_style(base))
    doc.add_edge(source=svc, target=deploy, style=edge_style(base))
    doc.add_edge(source=deploy, target=pods, style=edge_style(base))
    doc.add_edge(source=cfg, target=deploy, style=edge_style(base, dashed=True))
    doc.add_edge(source=sec, target=deploy, style=edge_style(base, dashed=True))
    doc.add_edge(source=sa_app, target=pods, style=edge_style(base, dashed=True), value="bind (optional)")

    doc.add_edge(source=sm, target=prom, style=edge_style(base, dashed=True), value="scrape")
    doc.add_edge(source=prom, target=graf, style=edge_style(base), value="query")
    doc.add_edge(source=promtail, target=loki, style=edge_style(base, dashed=True), value="push")
    doc.add_edge(source=loki, target=graf, style=edge_style(base), value="query")

    doc.add_edge(source=sa_alb, target=dep_alb, style=edge_style(base, dashed=True), value="bind")
    doc.add_edge(source=sa_dns, target=dep_dns, style=edge_style(base, dashed=True), value="bind")
    doc.add_edge(source=ingress, target=alb_ext, style=edge_style(base, dashed=True), value="provision ALB/TG")
    doc.add_edge(source=alb_ext, target=svc, style=edge_style(base), value="HTTP(S)")
    doc.add_edge(source=pods, target=ecr, style=edge_style(base, dashed=True), value="pull")
    doc.add_edge(source=pods, target=rds, style=edge_style(base), value="SQL")
    doc.add_edge(source=pods, target=redis, style=edge_style(base), value="Cache")
    doc.add_edge(source=pods, target=secrets, style=edge_style(base, dashed=True), value="(optional) AWS SDK")

    add_legend(
        doc,
        styles,
        680,
        540,
        1220,
        260,
        [
            "Accurate mapping to Terraform outputs:",
            "- Ingress certificate uses edge output: alb_certificate_arn",
            "- Controllers use IRSA roles from eks-irsa outputs",
            "Node placement uses labels from terraform: nodegroup=<name>",
            "Manifests (EKS): k8s/eks/app/{namespace,backend,hpa,pdb}.yaml",
            "Docs:",
            *[f"- {u}" for u in docs["platform"]],
        ],
    )

    return doc


def view_runtime_flow(styles: Styles, docs: dict[str, list[str]]) -> Doc:
    doc = Doc("03) Request/Traffic Flow (Runtime Data Plane)", model_attrs_template())
    add_title(doc, styles, "Tiketi - Request / Traffic Flow (Runtime Data Plane)")

    doc.add_vertex(value="Global Edge", style=styles.dashed_box, x=60, y=120, w=1880, h=260)
    doc.add_vertex(value="Regional (ap-northeast-2)", style=styles.dashed_box, x=60, y=410, w=1880, h=720)

    user = doc.add_vertex(value="Users", style=styles.by_value["Users"], x=100, y=180, w=70, h=70)
    r53 = doc.add_vertex(value="Route53", style=styles.by_value["Route53"], x=220, y=180, w=78, h=78)
    cf = doc.add_vertex(value="CloudFront", style=styles.by_value["Cloud Front"], x=380, y=180, w=78, h=78)
    s3 = doc.add_vertex(value="S3\nStatic", style=styles.by_value["S3"], x=560, y=180, w=78, h=78)

    alb = doc.add_vertex(value="ALB", style=styles.by_value["ALB Capacity"].replace("ALB Capacity", ""), x=560, y=470, w=78, h=78)
    eks = doc.add_vertex(value="EKS\nIngress->Service->Pods", style=styles.group["group_ec2_instance_contents"], x=760, y=440, w=520, h=320)
    pods = doc.add_vertex(value="Backend Pods", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#EFF6FF;strokeColor=#147EBA;", x=920, y=520, w=200, h=70)

    redis = doc.add_vertex(value="ElastiCache", style=styles.by_value["ElastiCache"], x=1340, y=470, w=78, h=78)
    rdsproxy = doc.add_vertex(value="RDS Proxy", style=styles.by_value["RDS"], x=1460, y=470, w=78, h=78)
    rds = doc.add_vertex(value="RDS", style=styles.by_value["RDS"], x=1600, y=470, w=78, h=78)

    prom = doc.add_vertex(value="Prometheus", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FCE7F3;strokeColor=#BC1356;", x=1340, y=640, w=160, h=60)
    graf = doc.add_vertex(value="Grafana", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FCE7F3;strokeColor=#BC1356;", x=1520, y=640, w=160, h=60)
    loki = doc.add_vertex(value="Loki", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FCE7F3;strokeColor=#BC1356;", x=1340, y=730, w=160, h=60)

    base = styles.edge_base
    doc.add_edge(source=user, target=r53, style=edge_style(base), value="1")
    doc.add_edge(source=r53, target=cf, style=edge_style(base), value="2")
    doc.add_edge(source=cf, target=s3, style=edge_style(base), value="3a: static")
    doc.add_edge(source=cf, target=alb, style=edge_style(base), value="3b: /api/*")

    doc.add_edge(source=alb, target=pods, style=edge_style(base), value="4")
    doc.add_edge(source=pods, target=redis, style=edge_style(base, dashed=True), value="5a")
    doc.add_edge(source=pods, target=rdsproxy, style=edge_style(base, dashed=True), value="5b")
    doc.add_edge(source=rdsproxy, target=rds, style=edge_style(base), value="5c")

    doc.add_edge(source=pods, target=prom, style=edge_style(base, dashed=True), value="/metrics")
    doc.add_edge(source=prom, target=graf, style=edge_style(base), value="query")
    doc.add_edge(source=pods, target=loki, style=edge_style(base, dashed=True), value="logs")
    doc.add_edge(source=loki, target=graf, style=edge_style(base), value="query")

    add_legend(
        doc,
        styles,
        90,
        900,
        620,
        220,
        [
            "Numbered edges show request sequence",
            "/api/* is separate origin behavior",
            "Docs:",
            *[f"- {u}" for u in docs["flow"]],
        ],
    )

    return doc


def view_cicd_gitops(styles: Styles, docs: dict[str, list[str]]) -> Doc:
    doc = Doc("04) CI/CD & GitOps Pipeline (Delivery View)", model_attrs_template())
    add_title(doc, styles, "Tiketi - CI/CD & GitOps Pipeline (Delivery View)")

    doc.add_vertex(value="Developers", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F3F4F6;strokeColor=#6B7280;", x=80, y=140, w=280, h=120)
    git = doc.add_vertex(value="GitHub Repo", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#111827;", x=400, y=150, w=260, h=90)

    gha = doc.add_vertex(value="GitHub Actions\n(workflow: deploy.yml)", style="rounded=1;whiteSpace=wrap;html=1;fillColor=white;strokeColor=#111827;", x=720, y=120, w=380, h=160)
    oidc = doc.add_vertex(value="OIDC\nAssumeRole", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F2F8;strokeColor=#147EBA;", x=1140, y=140, w=240, h=120)
    iam = doc.add_vertex(value="IAM Role\n(GitHub OIDC)", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F2F8;strokeColor=#147EBA;", x=1420, y=140, w=240, h=120)

    # artifacts / targets
    ecr = doc.add_vertex(value="ECR\nbackend image", style=styles.by_value["S3"].replace("resIcon=mxgraph.aws4.s3", "resIcon=mxgraph.aws4.ecr").replace("fillColor=#7AA116", "fillColor=#D05C17"), x=860, y=360, w=78, h=78)
    s3 = doc.add_vertex(value="S3\nfrontend build", style=styles.by_value["S3"], x=640, y=360, w=78, h=78)
    cf = doc.add_vertex(value="CloudFront\nInvalidate", style=styles.by_value["Cloud Front"], x=740, y=360, w=78, h=78)

    # GitOps target
    argocd = doc.add_vertex(value="ArgoCD\n(GitOps)", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FCE7F3;strokeColor=#BC1356;", x=1240, y=360, w=240, h=100)
    eks = doc.add_vertex(value="EKS\nDeploy/Rollout", style=styles.by_value["EKS"], x=1520, y=370, w=78, h=78)

    # Infra pipeline
    tg = doc.add_vertex(value="Terragrunt/Terraform\n(live/ envs)", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F3F4F6;strokeColor=#6B7280;", x=1240, y=520, w=240, h=100)
    state = doc.add_vertex(value="S3+DDB\nTerraform State", style=styles.by_value["S3"], x=1520, y=540, w=78, h=78)

    base = styles.edge_base
    doc.add_edge(source=git, target=gha, style=edge_style(base), value="push")
    doc.add_edge(source=gha, target=oidc, style=edge_style(base, dashed=True))
    doc.add_edge(source=oidc, target=iam, style=edge_style(base, dashed=True), value="sts")

    doc.add_edge(source=gha, target=s3, style=edge_style(base), value="build+sync")
    doc.add_edge(source=gha, target=ecr, style=edge_style(base), value="docker build/push")
    doc.add_edge(source=s3, target=cf, style=edge_style(base, dashed=True), value="origin")

    doc.add_edge(source=git, target=argocd, style=edge_style(base, dashed=True), value="watch")
    doc.add_edge(source=argocd, target=eks, style=edge_style(base), value="sync")
    doc.add_edge(source=ecr, target=eks, style=edge_style(base, dashed=True), value="pull")

    doc.add_edge(source=gha, target=tg, style=edge_style(base, dashed=True), value="infra")
    doc.add_edge(source=tg, target=state, style=edge_style(base, dashed=True), value="state")
    doc.add_edge(source=tg, target=eks, style=edge_style(base, dashed=True), value="provision")

    add_legend(
        doc,
        styles,
        80,
        720,
        620,
        280,
        [
            "Delivery separates: App (GitOps) vs Infra (Terraform)",
            "Note: repo has legacy EC2 deploy job; diagram shows target EKS GitOps view",
            "Docs:",
            *[f"- {u}" for u in docs["delivery"]],
        ],
    )

    return doc


def view_observability(styles: Styles, docs: dict[str, list[str]]) -> Doc:
    doc = Doc("05) Observability (Signals View)", model_attrs_template())
    add_title(doc, styles, "Tiketi - Observability (Signals View: Metrics / Logs / Traces)")

    doc.add_vertex(value="Signals", style=styles.dashed_box, x=60, y=90, w=1880, h=1040)

    app = doc.add_vertex(value="Backend Pods", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#EFF6FF;strokeColor=#147EBA;", x=120, y=240, w=260, h=100)

    # metrics
    prom = doc.add_vertex(value="Metrics\nPrometheus", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF7ED;strokeColor=#F59E0B;", x=520, y=170, w=240, h=110)
    graf = doc.add_vertex(value="Dashboards\nGrafana", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF7ED;strokeColor=#F59E0B;", x=860, y=170, w=240, h=110)
    alert = doc.add_vertex(value="Alerting\nAlertmanager", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF7ED;strokeColor=#F59E0B;", x=1200, y=170, w=240, h=110)

    # logs
    promtail = doc.add_vertex(value="Logs Agent\nPromtail/FluentBit", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FCE7F3;strokeColor=#BC1356;", x=520, y=360, w=240, h=110)
    loki = doc.add_vertex(value="Logs Store\nLoki", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FCE7F3;strokeColor=#BC1356;", x=860, y=360, w=240, h=110)

    # traces (optional)
    otel = doc.add_vertex(value="Traces\nOTel Collector (ADOT)", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F2F8;strokeColor=#147EBA;", x=520, y=550, w=240, h=110)
    xray = doc.add_vertex(value="Trace Backend\nX-Ray (opt)", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F2F8;strokeColor=#147EBA;", x=860, y=550, w=240, h=110)

    base = styles.edge_base
    doc.add_edge(source=app, target=prom, style=edge_style(base, dashed=True), value="/metrics")
    doc.add_edge(source=prom, target=graf, style=edge_style(base), value="query")
    doc.add_edge(source=prom, target=alert, style=edge_style(base, dashed=True), value="rules")

    doc.add_edge(source=app, target=promtail, style=edge_style(base, dashed=True), value="stdout")
    doc.add_edge(source=promtail, target=loki, style=edge_style(base, dashed=True), value="push")
    doc.add_edge(source=loki, target=graf, style=edge_style(base), value="query")

    doc.add_edge(source=app, target=otel, style=edge_style(base, dashed=True), value="OTLP")
    doc.add_edge(source=otel, target=xray, style=edge_style(base, dashed=True), value="export")

    add_legend(
        doc,
        styles,
        120,
        760,
        760,
        320,
        [
            "Metrics: scrape/query/alert",
            "Logs: agent -> store -> query",
            "Traces: OTLP -> collector -> backend",
            "Docs:",
            *[f"- {u}" for u in docs["observability"]],
        ],
    )

    return doc


def view_security_identity(styles: Styles, docs: dict[str, list[str]]) -> Doc:
    doc = Doc("06) Security & Identity (Zero Trust / Boundary View)", model_attrs_template())
    add_title(doc, styles, "Tiketi - Security & Identity (Zero Trust / Boundary View)")

    # boundaries
    doc.add_vertex(value="Internet", style=styles.dashed_box, x=60, y=120, w=420, h=980)
    doc.add_vertex(value="Edge (Global / us-east-1)", style=styles.dashed_box, x=510, y=120, w=520, h=980)
    doc.add_vertex(value="VPC (ap-northeast-2)", style=styles.dashed_box, x=1060, y=120, w=880, h=980)

    user = doc.add_vertex(value="Users", style=styles.by_value["Users"], x=120, y=180, w=70, h=70)

    # edge
    r53 = doc.add_vertex(value="Route53", style=styles.by_value["Route53"], x=560, y=180, w=78, h=78)
    waf = doc.add_vertex(value="WAF", style=styles.by_value["WAF"], x=720, y=150, w=70, h=70)
    cf = doc.add_vertex(value="CloudFront", style=styles.by_value["Cloud Front"], x=720, y=240, w=78, h=78)
    acm = doc.add_vertex(value="ACM\nTLS", style=styles.by_value.get("ACM", styles.by_value["WAF"]).replace("resIcon=mxgraph.aws4.waf", "resIcon=mxgraph.aws4.acm"), x=860, y=150, w=70, h=70)

    # vpc
    alb = doc.add_vertex(value="ALB\n(SG: 443)", style=styles.by_value["ALB Capacity"].replace("ALB Capacity", ""), x=1120, y=200, w=78, h=78)
    eks = doc.add_vertex(value="EKS\nNodes(SG)", style=styles.by_value["EKS"], x=1280, y=200, w=78, h=78)
    vpce = doc.add_vertex(value="VPC Endpoints\n(PrivateLink)", style=styles.by_value["Secret Manager"].replace("resIcon=mxgraph.aws4.secrets_manager", "resIcon=mxgraph.aws4.vpc_endpoint"), x=1440, y=200, w=78, h=78)

    secrets = doc.add_vertex(value="Secrets Manager", style=styles.by_value["Secret Manager"], x=1600, y=180, w=78, h=78)
    kms = doc.add_vertex(value="KMS", style=styles.by_value["Secret Manager"].replace("resIcon=mxgraph.aws4.secrets_manager", "resIcon=mxgraph.aws4.kms"), x=1760, y=180, w=78, h=78)

    rds = doc.add_vertex(value="RDS (SG)", style=styles.by_value["RDS"], x=1280, y=360, w=78, h=78)
    redis = doc.add_vertex(value="Redis (SG)", style=styles.by_value["ElastiCache"], x=1440, y=360, w=78, h=78)

    iam = doc.add_vertex(value="IAM\n(GitHub OIDC / IRSA)", style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F2F8;strokeColor=#147EBA;", x=1120, y=520, w=360, h=120)

    # labels
    doc.add_vertex(value="Enforce: WAF rules", style=styles.text.replace("align=center", "align=left") + ";fontSize=11", x=520, y=340, w=500, h=20)
    doc.add_vertex(value="Enforce: SG / subnet routing", style=styles.text.replace("align=center", "align=left") + ";fontSize=11", x=1080, y=680, w=500, h=20)

    base = styles.edge_base
    doc.add_edge(source=user, target=r53, style=edge_style(base), value="DNS")
    doc.add_edge(source=r53, target=cf, style=edge_style(base), value="HTTPS")
    doc.add_edge(source=waf, target=cf, style=edge_style(base, dashed=True))
    doc.add_edge(source=acm, target=cf, style=edge_style(base, dashed=True))

    doc.add_edge(source=cf, target=alb, style=edge_style(base), value="/api/*")
    doc.add_edge(source=alb, target=eks, style=edge_style(base), value="to pods")

    doc.add_edge(source=eks, target=vpce, style=edge_style(base, dashed=True), value="private")
    doc.add_edge(source=vpce, target=secrets, style=edge_style(base, dashed=True))
    doc.add_edge(source=secrets, target=kms, style=edge_style(base, dashed=True), value="encrypt")

    doc.add_edge(source=eks, target=rds, style=edge_style(base, dashed=True), value="5432")
    doc.add_edge(source=eks, target=redis, style=edge_style(base, dashed=True), value="6379")

    doc.add_edge(source=iam, target=eks, style=edge_style(base, dashed=True), value="IRSA")

    add_legend(
        doc,
        styles,
        120,
        760,
        840,
        340,
        [
            "Boundary-first view (Zero Trust-ish)",
            "Edge controls: TLS+WAF",
            "Identity: GitHub OIDC + IRSA",
            "Network: SG + VPCE",
            "Docs:",
            *[f"- {u}" for u in docs["security"]],
        ],
    )

    return doc


def build_docs_map() -> dict[str, list[str]]:
    # Keep short URLs in diagrams (human-readable and non-noisy)
    return {
        "infra": [
            "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html",
            "https://docs.aws.amazon.com/waf/latest/developerguide/how-aws-waf-works-resources.html",
            "https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html",
            "https://docs.aws.amazon.com/prescriptive-guidance/latest/amazon-rds-proxy/best-practices.html",
            "https://docs.aws.amazon.com/AmazonECR/latest/userguide/vpc-endpoints.html",
            "https://raw.githubusercontent.com/hashicorp/terraform-provider-aws/main/website/docs/r/cloudfront_origin_access_control.html.markdown",
            "https://raw.githubusercontent.com/hashicorp/terraform-provider-aws/main/website/docs/r/vpc_endpoint.html.markdown",
            "https://raw.githubusercontent.com/hashicorp/terraform-provider-aws/main/website/docs/r/db_proxy.html.markdown",
        ],
        "platform": [
            "https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html",
            "https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html",
            "https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html",
            "https://docs.aws.amazon.com/eks/latest/best-practices/load-balancing.html",
        ],
        "flow": [
            "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html",
            "https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html",
        ],
        "delivery": [
            "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_oidc.html",
        ],
        "observability": [
            "https://docs.aws.amazon.com/prescriptive-guidance/latest/amazon-eks-observability-best-practices/introduction.html",
        ],
        "security": [
            "https://docs.aws.amazon.com/waf/latest/developerguide/how-aws-waf-works-resources.html",
            "https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html",
        ],
    }


def main() -> None:
    group_styles, by_value, edge_base = extract_styles()
    styles = build_common_styles(group_styles, by_value, edge_base)

    docs = build_docs_map()

    views = [
        ("01-infra-outer-terraform.drawio", view_infra_outer(styles, docs)),
        ("02-platform-inner-k8s.drawio", view_platform_inner(styles, docs)),
        ("03-runtime-traffic-flow.drawio", view_runtime_flow(styles, docs)),
        ("04-cicd-gitops.drawio", view_cicd_gitops(styles, docs)),
        ("05-observability-signals.drawio", view_observability(styles, docs)),
        ("06-security-identity-zerotrust.drawio", view_security_identity(styles, docs)),
    ]

    os.makedirs(OUT_DIR, exist_ok=True)

    for filename, doc in views:
        out = os.path.join(OUT_DIR, filename)
        doc.write(out)


if __name__ == "__main__":
    main()
